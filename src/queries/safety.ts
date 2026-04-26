import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db/prisma.js";
import AppError from "../utils/appError.js";

type DeleteAccountResult = {
  deletedAt: Date;
  disabledMatchCount: number;
  systemMessageCount: number;
};

type BlockUserResult = {
  blockedUserId: number;
  blockedAt: Date;
  disabledMatchId: number | null;
};

type UnblockUserResult = {
  unblockedUserId: number;
  removed: boolean;
};

type UnmatchResult = {
  matchId: number;
  unmatchedAt: Date;
};

function normalizePositiveInteger(value: unknown, field: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${field} must be a valid integer`, 400);
  }

  return parsed;
}

function getCanonicalMatchPair(userA: number, userB: number) {
  return userA < userB
    ? { user1_id: userA, user2_id: userB }
    : { user1_id: userB, user2_id: userA };
}

async function assertActiveUserExists(
  tx: Prisma.TransactionClient,
  userId: number,
  message = "User not found"
) {
  const user = await tx.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true, account_status: true },
  });

  if (!user || user.account_status !== "active") {
    throw new AppError(message, 404);
  }

  return user;
}

export function normalizeTargetUserInput(payload: Record<string, unknown>) {
  return {
    targetUserId: normalizePositiveInteger(payload.targetUserId, "targetUserId"),
  };
}

export function normalizeMatchInput(matchIdParam: unknown) {
  return {
    matchId: normalizePositiveInteger(matchIdParam, "matchId"),
  };
}

export async function deleteMyAccount(
  currentUserId: number
): Promise<DeleteAccountResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { user_id: currentUserId },
      select: { user_id: true, account_status: true },
    });

    if (!user || user.account_status === "deleted") {
      throw new AppError("User not found", 404);
    }

    const activeMatches = await tx.matches.findMany({
      where: {
        status: "active",
        OR: [{ user1_id: currentUserId }, { user2_id: currentUserId }],
      },
      select: { match_id: true },
    });

    const deletedAt = new Date();

    await tx.users.update({
      where: { user_id: currentUserId },
      data: {
        account_status: "deleted",
        deletion_time: deletedAt,
        full_name: null,
        profile_pic: null,
        biography: null,
        ideas: null,
      },
    });

    const disabledMatches = await tx.matches.updateMany({
      where: {
        status: "active",
        OR: [{ user1_id: currentUserId }, { user2_id: currentUserId }],
      },
      data: { status: "unmatched" },
    });

    if (activeMatches.length > 0) {
      await tx.messages.createMany({
        data: activeMatches.map((match) => ({
          match_id: match.match_id,
          sender_id: null,
          message: "This user has deleted their account. This chat is no longer active.",
          unread: true,
        })),
      });
    }

    return {
      deletedAt,
      disabledMatchCount: disabledMatches.count,
      systemMessageCount: activeMatches.length,
    };
  });
}

export async function blockUser(
  currentUserId: number,
  targetUserId: number
): Promise<BlockUserResult> {
  if (currentUserId === targetUserId) {
    throw new AppError("You cannot block your own account", 409);
  }

  return prisma.$transaction(async (tx) => {
    await assertActiveUserExists(tx, currentUserId, "Current user not found");
    await assertActiveUserExists(tx, targetUserId, "Target user not found");

    let block;

    try {
      block = await tx.blocked_users.create({
        data: {
          blocker_id: currentUserId,
          blocked_id: targetUserId,
        },
        select: {
          blocked_id: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("User already blocked", 409);
      }

      throw error;
    }

    const match = await tx.matches.findFirst({
      where: {
        status: "active",
        OR: [
          { user1_id: currentUserId, user2_id: targetUserId },
          { user1_id: targetUserId, user2_id: currentUserId },
        ],
      },
      select: { match_id: true },
    });

    if (match) {
      await tx.matches.update({
        where: { match_id: match.match_id },
        data: { status: "blocked" },
      });

      await tx.messages.create({
        data: {
          match_id: match.match_id,
          sender_id: null,
          message: "This chat is no longer active because a user was blocked.",
          unread: true,
        },
      });
    }

    return {
      blockedUserId: block.blocked_id,
      blockedAt: new Date(),
      disabledMatchId: match?.match_id ?? null,
    };
  });
}

export async function unblockUser(
  currentUserId: number,
  targetUserId: number
): Promise<UnblockUserResult> {
  if (currentUserId === targetUserId) {
    throw new AppError("You cannot unblock your own account", 409);
  }

  const deleted = await prisma.blocked_users.deleteMany({
    where: {
      blocker_id: currentUserId,
      blocked_id: targetUserId,
    },
  });

  return {
    unblockedUserId: targetUserId,
    removed: deleted.count > 0,
  };
}

export async function unmatchUser(
  currentUserId: number,
  matchId: number
): Promise<UnmatchResult> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.matches.findUnique({
      where: { match_id: matchId },
      select: {
        match_id: true,
        user1_id: true,
        user2_id: true,
        status: true,
      },
    });

    if (!match) {
      throw new AppError("Match not found", 404);
    }

    const isParticipant =
      match.user1_id === currentUserId || match.user2_id === currentUserId;

    if (!isParticipant) {
      throw new AppError("Match not found", 404);
    }

    if (match.status !== "active") {
      throw new AppError("Match is not active", 409);
    }

    const unmatchedAt = new Date();

    await tx.matches.update({
      where: { match_id: matchId },
      data: { status: "unmatched" },
    });

    await tx.messages.create({
      data: {
        match_id: matchId,
        sender_id: null,
        message: "This chat is no longer active because the match was ended.",
        unread: true,
      },
    });

    const otherUserId =
      match.user1_id === currentUserId ? match.user2_id : match.user1_id;
    const pair = getCanonicalMatchPair(currentUserId, otherUserId);

    await tx.passes.upsert({
      where: {
        passer_id_passed_id: {
          passer_id: currentUserId,
          passed_id: otherUserId,
        },
      },
      update: {},
      create: {
        passer_id: currentUserId,
        passed_id: otherUserId,
      },
    });

    await tx.passes.upsert({
      where: {
        passer_id_passed_id: {
          passer_id: otherUserId,
          passed_id: currentUserId,
        },
      },
      update: {},
      create: {
        passer_id: otherUserId,
        passed_id: currentUserId,
      },
    });

    await tx.notifications.deleteMany({
      where: {
        match_id: matchId,
        OR: [{ user_id: pair.user1_id }, { user_id: pair.user2_id }],
      },
    });

    return {
      matchId,
      unmatchedAt,
    };
  });
}
