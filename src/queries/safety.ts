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

type BlockedUserListItem = {
  userId: number;
  fullName: string | null;
  major: string | null;
  yearOfStudy: number | null;
  profilePicture: string | null;
  blockedAt: Date;
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

export async function getBlockedUsers(
  currentUserId: number
): Promise<BlockedUserListItem[]> {
  await assertActiveUserExists(prisma, currentUserId, "Current user not found");

  const blockedUsers = await prisma.blocked_users.findMany({
    where: { blocker_id: currentUserId },
    orderBy: { block_id: "desc" },
    select: {
      blocked_id: true,
      users_blocked_users_blocked_idTousers: {
        select: {
          full_name: true,
          profile_pic: true,
          majors: {
            select: {
              majors: true,
            },
          },
          years: {
            select: {
              year: true,
            },
          },
        },
      },
    },
  });

  return blockedUsers.map((entry) => ({
    userId: entry.blocked_id,
    fullName: entry.users_blocked_users_blocked_idTousers.full_name,
    major: entry.users_blocked_users_blocked_idTousers.majors?.majors ?? null,
    yearOfStudy: entry.users_blocked_users_blocked_idTousers.years?.year ?? null,
    profilePicture: entry.users_blocked_users_blocked_idTousers.profile_pic ?? null,
    blockedAt: new Date(),
  }));
}

export async function blockUser(
  currentUserId: number,
  targetUserId: number
): Promise<BlockUserResult> {
  if (currentUserId === targetUserId) {
    throw new AppError("You cannot restrict your own account", 409);
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
        throw new AppError("User already restricted", 409);
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
      await tx.matches.delete({
        where: { match_id: match.match_id },
      });
    }

    await tx.likes.deleteMany({
      where: {
        OR: [
          { liker_id: currentUserId, liked_id: targetUserId },
          { liker_id: targetUserId, liked_id: currentUserId },
        ],
      },
    });

    await tx.passes.deleteMany({
      where: {
        OR: [
          { passer_id: currentUserId, passed_id: targetUserId },
          { passer_id: targetUserId, passed_id: currentUserId },
        ],
      },
    });

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
    throw new AppError("You cannot unrestrict your own account", 409);
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const removed = await tx.blocked_users.deleteMany({
      where: {
        blocker_id: currentUserId,
        blocked_id: targetUserId,
      },
    });

    await tx.matches.deleteMany({
      where: {
        status: "blocked",
        OR: [
          { user1_id: currentUserId, user2_id: targetUserId },
          { user1_id: targetUserId, user2_id: currentUserId },
        ],
      },
    });

    await tx.likes.deleteMany({
      where: {
        OR: [
          { liker_id: currentUserId, liked_id: targetUserId },
          { liker_id: targetUserId, liked_id: currentUserId },
        ],
      },
    });

    await tx.passes.deleteMany({
      where: {
        OR: [
          { passer_id: currentUserId, passed_id: targetUserId },
          { passer_id: targetUserId, passed_id: currentUserId },
        ],
      },
    });

    return removed;
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
