import { prisma } from "../db/prisma.js";
import AppError from "../utils/appError.js";

type DiscoveryFilters = {
  currentUserId: number;
  skillIds?: number[];
  interestIds?: number[];
  limit: number;
};

type DiscoveryProfile = {
  userId: number;
  fullName: string | null;
  major: string | null;
  yearOfStudy: number | null;
  profilePicture: string | null;
  bio: string | null;
  fypIdea: string | null;
  skills: string[];
  interests: string[];
  projects: Array<{
    project_name: string;
    project_link: string | null;
  }>;
  links: Record<string, string>;
};

function parsePositiveInteger(value: string, field: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${field} must contain valid integers`, 400);
  }

  return parsed;
}

function normalizeIdList(value: unknown, field: string): number[] | undefined {
  if (value === undefined) return undefined;

  const rawValues = Array.isArray(value) ? value : [value];
  const splitValues = rawValues
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);

  if (splitValues.length === 0) {
    return [];
  }

  return [...new Set(splitValues.map((item) => parsePositiveInteger(item, field)))];
}

function normalizeLimit(value: unknown) {
  if (value === undefined) return 20;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new AppError("limit must be an integer between 1 and 50", 400);
  }

  return limit;
}

async function assertSkillIdsExist(skillIds: number[]) {
  if (skillIds.length === 0) return;

  const count = await prisma.skills.count({
    where: { skill_id: { in: skillIds } },
  });

  if (count !== skillIds.length) {
    throw new AppError("One or more skill IDs are invalid", 400);
  }
}

async function assertInterestIdsExist(interestIds: number[]) {
  if (interestIds.length === 0) return;

  const count = await prisma.interests.count({
    where: { interest_id: { in: interestIds } },
  });

  if (count !== interestIds.length) {
    throw new AppError("One or more interest IDs are invalid", 400);
  }
}

export function normalizeDiscoveryFilters(
  currentUserId: number,
  query: Record<string, unknown>
): DiscoveryFilters {
  const skillIds = normalizeIdList(query.skillIds, "skillIds");
  const interestIds = normalizeIdList(query.interestIds, "interestIds");

  return {
    currentUserId,
    ...(skillIds !== undefined ? { skillIds } : {}),
    ...(interestIds !== undefined ? { interestIds } : {}),
    limit: normalizeLimit(query.limit),
  };
}

export async function getDiscoveryProfiles(
  filters: DiscoveryFilters
): Promise<DiscoveryProfile[]> {
  const { currentUserId, skillIds = [], interestIds = [], limit } = filters;

  await Promise.all([
    assertSkillIdsExist(skillIds),
    assertInterestIdsExist(interestIds),
  ]);

  const where: any = {
    user_id: { not: currentUserId },
    account_status: "active",
    full_name: { not: null },
    year: { not: null },
    major: { not: null },
    user_skills: {
      some: {},
    },
    user_interests: {
      some: {},
    },
    likes_likes_liked_idTousers: {
      none: {
        liker_id: currentUserId,
      },
    },
    passes_passes_passed_idTousers: {
      none: {
        passer_id: currentUserId,
      },
    },
    blocked_users_blocked_users_blocked_idTousers: {
      none: {
        blocker_id: currentUserId,
      },
    },
    blocked_users_blocked_users_blocker_idTousers: {
      none: {
        blocked_id: currentUserId,
      },
    },
    matches_matches_user1_idTousers: {
      none: {
        user2_id: currentUserId,
      },
    },
    matches_matches_user2_idTousers: {
      none: {
        user1_id: currentUserId,
      },
    },
  };

  if (skillIds.length > 0) {
    where.user_skills = {
      some: {
        skill_id: { in: skillIds },
      },
    };
  }

  if (interestIds.length > 0) {
    where.user_interests = {
      some: {
        interest_id: { in: interestIds },
      },
    };
  }

  const users = await prisma.users.findMany({
    where,
    take: limit,
    orderBy: [
      { profile_updated_at: "desc" },
      { created_at: "desc" },
    ],
    select: {
      user_id: true,
      full_name: true,
      profile_pic: true,
      biography: true,
      ideas: true,
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
      user_skills: {
        select: {
          skills: {
            select: {
              skill: true,
            },
          },
        },
      },
      user_interests: {
        select: {
          interests: {
            select: {
              interest: true,
            },
          },
        },
      },
      user_projects: {
        orderBy: {
          user_project_id: "asc",
        },
        select: {
          project_name: true,
          project_link: true,
        },
      },
      user_links: {
        select: {
          name_: true,
          link: true,
        },
      },
    },
  });

  return users.map((user) => ({
    userId: user.user_id,
    fullName: user.full_name,
    major: user.majors?.majors ?? null,
    yearOfStudy: user.years?.year ?? null,
    profilePicture: user.profile_pic,
    bio: user.biography,
    fypIdea: user.ideas,
    skills: user.user_skills.map((item) => item.skills.skill),
    interests: user.user_interests.map((item) => item.interests.interest),
    projects: user.user_projects,
    links: Object.fromEntries(user.user_links.map((item) => [item.name_, item.link])),
  }));
}
