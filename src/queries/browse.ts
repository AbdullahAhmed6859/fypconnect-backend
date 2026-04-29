import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db/prisma.js";
import AppError from "../utils/appError.js";

type LikeProfileResult = {
  isMutualMatch: boolean;
  likedAt: Date;
  match?: {
    matchId: number;
    createdAt: Date;
  };
};

type PassProfileResult = {
  passedAt: Date;
};

function normalizeTargetUserId(value: unknown) {
  const targetUserId = Number(value);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    throw new AppError("targetUserId must be a valid integer", 400);
  }

  return targetUserId;
}

function getCanonicalMatchPair(userA: number, userB: number) {
  return userA < userB
    ? { user1_id: userA, user2_id: userB }
    : { user1_id: userB, user2_id: userA };
}

function hasAnyOverlap(left: number[], right: number[]) {
  return left.some((value) => right.includes(value));
}

export function normalizeLikeProfileInput(
  currentUserId: number,
  payload: Record<string, unknown>
) {
  return {
    currentUserId,
    targetUserId: normalizeTargetUserId(payload.targetUserId),
  };
}

export function normalizePassProfileInput(
  currentUserId: number,
  payload: Record<string, unknown>
) {
  return {
    currentUserId,
    targetUserId: normalizeTargetUserId(payload.targetUserId),
  };
}

export async function likeProfile(
  currentUserId: number,
  targetUserId: number
): Promise<LikeProfileResult> {
  if (currentUserId === targetUserId) {
    throw new AppError("You cannot like your own profile", 409);
  }

  return prisma.$transaction(async (tx) => {
    const [currentUser, targetUser] = await Promise.all([
      tx.users.findUnique({
        where: { user_id: currentUserId },
        select: {
          user_id: true,
          account_status: true,
          year: true,
          skills_preferences: {
            select: { preferred_skill_id: true },
          },
          interests_preferences: {
            select: { preferred_interest_id: true },
          },
        },
      }),
      tx.users.findUnique({
        where: { user_id: targetUserId },
        select: {
          user_id: true,
          account_status: true,
          full_name: true,
          year: true,
          major: true,
          user_skills: {
            select: { skill_id: true },
          },
          user_interests: {
            select: { interest_id: true },
          },
        },
      }),
    ]);

    if (!currentUser || currentUser.account_status !== "active") {
      throw new AppError("Current user not found", 404);
    }

    if (!targetUser || targetUser.account_status !== "active") {
      throw new AppError("Target user not found", 404);
    }

    const targetProfileComplete = Boolean(
      targetUser.full_name && targetUser.year && targetUser.major
    );

    if (!targetProfileComplete) {
      throw new AppError("Target profile is not available for browsing", 409);
    }

    if (!currentUser.year || currentUser.year !== targetUser.year) {
      throw new AppError("Target profile is not available for browsing", 409);
    }

    const preferredSkillIds = currentUser.skills_preferences.map(
      (item) => item.preferred_skill_id
    );
    const preferredInterestIds = currentUser.interests_preferences.map(
      (item) => item.preferred_interest_id
    );
    const targetSkillIds = targetUser.user_skills.map((item) => item.skill_id);
    const targetInterestIds = targetUser.user_interests.map(
      (item) => item.interest_id
    );
    const matchesPreferredSkill = hasAnyOverlap(preferredSkillIds, targetSkillIds);
    const matchesPreferredInterest = hasAnyOverlap(
      preferredInterestIds,
      targetInterestIds
    );

    if (!matchesPreferredSkill && !matchesPreferredInterest) {
      throw new AppError("Target profile is not available for browsing", 409);
    }

    const [blocked, existingMatch, existingLike, existingPass] = await Promise.all([
      tx.blocked_users.findFirst({
        where: {
          OR: [
            { blocker_id: currentUserId, blocked_id: targetUserId },
            { blocker_id: targetUserId, blocked_id: currentUserId },
          ],
        },
        select: { block_id: true },
      }),
      tx.matches.findFirst({
        where: {
          OR: [
            { user1_id: currentUserId, user2_id: targetUserId },
            { user1_id: targetUserId, user2_id: currentUserId },
          ],
        },
        select: {
          match_id: true,
          created_at: true,
          status: true,
        },
      }),
      tx.likes.findFirst({
        where: {
          liker_id: currentUserId,
          liked_id: targetUserId,
        },
        select: {
          like_id: true,
          created_at: true,
        },
      }),
      tx.passes.findFirst({
        where: {
          passer_id: currentUserId,
          passed_id: targetUserId,
        },
        select: { pass_id: true },
      }),
    ]);

    if (blocked) {
      throw new AppError("You cannot like this profile", 409);
    }

    if (existingPass) {
      throw new AppError("Passed profiles cannot be liked again", 409);
    }

    if (existingMatch?.status === "active") {
      throw new AppError("You already have an active match with this user", 409);
    }

    if (existingLike) {
      throw new AppError("Profile already liked", 409);
    }

    let createdLike;

    try {
      createdLike = await tx.likes.create({
        data: {
          liker_id: currentUserId,
          liked_id: targetUserId,
        },
        select: {
          created_at: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("Profile already liked", 409);
      }

      throw error;
    }

    const reciprocalLike = await tx.likes.findFirst({
      where: {
        liker_id: targetUserId,
        liked_id: currentUserId,
      },
      select: {
        like_id: true,
      },
    });

    if (!reciprocalLike) {
      return {
        isMutualMatch: false,
        likedAt: createdLike.created_at,
      };
    }

    if (existingMatch) {
      return {
        isMutualMatch: false,
        likedAt: createdLike.created_at,
      };
    }

    const matchPair = getCanonicalMatchPair(currentUserId, targetUserId);
    const match = await tx.matches.create({
      data: matchPair,
      select: {
        match_id: true,
        created_at: true,
      },
    });

    await tx.notifications.createMany({
      data: [
        {
          user_id: currentUserId,
          match_id: match.match_id,
          type: "NEW_MATCH",
        },
        {
          user_id: targetUserId,
          match_id: match.match_id,
          type: "NEW_MATCH",
        },
      ],
    });

    return {
      isMutualMatch: true,
      likedAt: createdLike.created_at,
      match: {
        matchId: match.match_id,
        createdAt: match.created_at,
      },
    };
  });
}

export async function passProfile(
  currentUserId: number,
  targetUserId: number
): Promise<PassProfileResult> {
  if (currentUserId === targetUserId) {
    throw new AppError("You cannot pass your own profile", 409);
  }

  return prisma.$transaction(async (tx) => {
    const [currentUser, targetUser] = await Promise.all([
      tx.users.findUnique({
        where: { user_id: currentUserId },
        select: {
          user_id: true,
          account_status: true,
          year: true,
          skills_preferences: {
            select: { preferred_skill_id: true },
          },
          interests_preferences: {
            select: { preferred_interest_id: true },
          },
        },
      }),
      tx.users.findUnique({
        where: { user_id: targetUserId },
        select: {
          user_id: true,
          account_status: true,
          full_name: true,
          year: true,
          major: true,
          user_skills: {
            select: { skill_id: true },
          },
          user_interests: {
            select: { interest_id: true },
          },
        },
      }),
    ]);

    if (!currentUser || currentUser.account_status !== "active") {
      throw new AppError("Current user not found", 404);
    }

    if (!targetUser || targetUser.account_status !== "active") {
      throw new AppError("Target user not found", 404);
    }

    const targetProfileComplete = Boolean(
      targetUser.full_name && targetUser.year && targetUser.major
    );

    if (!targetProfileComplete) {
      throw new AppError("Target profile is not available for browsing", 409);
    }

    if (!currentUser.year || currentUser.year !== targetUser.year) {
      throw new AppError("Target profile is not available for browsing", 409);
    }

    const preferredSkillIds = currentUser.skills_preferences.map(
      (item) => item.preferred_skill_id
    );
    const preferredInterestIds = currentUser.interests_preferences.map(
      (item) => item.preferred_interest_id
    );
    const targetSkillIds = targetUser.user_skills.map((item) => item.skill_id);
    const targetInterestIds = targetUser.user_interests.map(
      (item) => item.interest_id
    );
    const matchesPreferredSkill = hasAnyOverlap(preferredSkillIds, targetSkillIds);
    const matchesPreferredInterest = hasAnyOverlap(
      preferredInterestIds,
      targetInterestIds
    );

    if (!matchesPreferredSkill && !matchesPreferredInterest) {
      throw new AppError("Target profile is not available for browsing", 409);
    }

    const [blocked, existingMatch, existingLike, existingPass] = await Promise.all([
      tx.blocked_users.findFirst({
        where: {
          OR: [
            { blocker_id: currentUserId, blocked_id: targetUserId },
            { blocker_id: targetUserId, blocked_id: currentUserId },
          ],
        },
        select: { block_id: true },
      }),
      tx.matches.findFirst({
        where: {
          OR: [
            { user1_id: currentUserId, user2_id: targetUserId },
            { user1_id: targetUserId, user2_id: currentUserId },
          ],
        },
        select: {
          match_id: true,
          status: true,
        },
      }),
      tx.likes.findFirst({
        where: {
          liker_id: currentUserId,
          liked_id: targetUserId,
        },
        select: {
          like_id: true,
        },
      }),
      tx.passes.findFirst({
        where: {
          passer_id: currentUserId,
          passed_id: targetUserId,
        },
        select: {
          pass_id: true,
        },
      }),
    ]);

    if (blocked) {
      throw new AppError("You cannot pass this profile", 409);
    }

    if (existingMatch?.status === "active") {
      throw new AppError("You already have an active match with this user", 409);
    }

    if (existingLike) {
      throw new AppError("Liked profiles cannot be passed", 409);
    }

    if (existingPass) {
      throw new AppError("Profile already passed", 409);
    }

    let createdPass;

    try {
      createdPass = await tx.passes.create({
        data: {
          passer_id: currentUserId,
          passed_id: targetUserId,
        },
        select: {
          created_at: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("Profile already passed", 409);
      }

      throw error;
    }

    return {
      passedAt: createdPass.created_at,
    };
  });
}
