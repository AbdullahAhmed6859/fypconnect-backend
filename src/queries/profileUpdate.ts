import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db/prisma";
import AppError from "../utils/appError";

type AllowedLinkName = "github" | "linkedin" | "portfolio";

type LinkPatch = Partial<Record<AllowedLinkName, string | null>>;

type ProjectInput = {
  project_name: string;
  project_link?: string | null;
};

type UpdateProfilePayload = {
  fullName?: string;
  yearId?: number;
  majorId?: number;
  skills?: number[];
  interests?: number[];
  preferredMajorIds?: number[];
  preferredSkillIds?: number[];
  preferredInterestIds?: number[];
  bio?: string | null;
  projects?: ProjectInput[];
  fypIdea?: string | null;
  links?: LinkPatch;
  profilePicture?: string | null;
};

const LINK_NAMES: AllowedLinkName[] = ["github", "linkedin", "portfolio"];

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

function toOptionalText(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(`${field} must be a string`, 400);
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validateHttpUrl(url: string, field: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(`${field} must be a valid URL`, 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError(`${field} must be a valid HTTP/HTTPS URL`, 400);
  }
}

function normalizeOptionalId(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${field} must be a valid integer`, 400);
  }

  return id;
}

function normalizeIdArray(value: unknown, field: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new AppError(`${field} must be an array of integers`, 400);
  }

  const ids = [...new Set(value.map((item) => Number(item)))];
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new AppError(`${field} must contain at least one valid integer`, 400);
  }

  return ids;
}

function normalizeOptionalIdArray(value: unknown, field: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new AppError(`${field} must be an array of integers`, 400);
  }

  const ids = [...new Set(value.map((item) => Number(item)))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new AppError(`${field} must contain valid integers`, 400);
  }

  return ids;
}

function normalizeProjects(value: unknown): ProjectInput[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new AppError("projects must be an array", 400);
  }

  return value.map((project, index) => {
    if (!project || typeof project !== "object") {
      throw new AppError(`projects[${index}] must be an object`, 400);
    }

    const projectName = toOptionalText(
      (project as Record<string, unknown>).project_name,
      `projects[${index}].project_name`,
    );

    if (!projectName) {
      throw new AppError(`projects[${index}].project_name is required`, 400);
    }

    const projectLink = toOptionalText(
      (project as Record<string, unknown>).project_link,
      `projects[${index}].project_link`,
    );

    if (projectLink) {
      validateHttpUrl(projectLink, `projects[${index}].project_link`);
    }

    return {
      project_name: projectName,
      project_link: projectLink ?? null,
    };
  });
}

function normalizeLinks(value: unknown): LinkPatch | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("links must be an object", 400);
  }

  const record = value as Record<string, unknown>;
  const normalized: LinkPatch = {};

  for (const key of LINK_NAMES) {
    if (!(key in record)) continue;

    const raw = record[key];

    if (raw === null) {
      normalized[key] = null;
      continue;
    }

    if (typeof raw !== "string") {
      throw new AppError(`links.${key} must be a string`, 400);
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      normalized[key] = null;
      continue;
    }

    validateHttpUrl(trimmed, `links.${key}`);
    normalized[key] = trimmed;
  }

  return normalized;
}

function isProfileComplete(user: any) {
  return Boolean(
    user.full_name &&
    user.year &&
    user.major &&
    user.user_skills.length > 0 &&
    user.user_interests.length > 0,
  );
}

function buildLinksObject(userLinks: Array<{ name_: string; link: string }>) {
  const links: Record<string, string> = {};
  for (const link of userLinks) {
    links[link.name_] = link.link;
  }
  return links;
}

function snapshotKeyFields(user: any) {
  return JSON.stringify({
    yearId: user.year ?? null,
    majorId: user.major ?? null,
    skills: user.user_skills
      .map((item: any) => item.skill_id)
      .sort((a: number, b: number) => a - b),
    interests: user.user_interests
      .map((item: any) => item.interest_id)
      .sort((a: number, b: number) => a - b),
    preferredMajorIds: user.major_preferences
      .map((item: any) => item.preferred_major_id)
      .sort((a: number, b: number) => a - b),
    preferredSkillIds: user.skills_preferences
      .map((item: any) => item.preferred_skill_id)
      .sort((a: number, b: number) => a - b),
    preferredInterestIds: user.interests_preferences
      .map((item: any) => item.preferred_interest_id)
      .sort((a: number, b: number) => a - b),
    bio: user.biography ?? null,
    fypIdea: user.ideas ?? null,
    projects: user.user_projects
      .map((project: any) => ({
        project_name: project.project_name,
        project_link: project.project_link ?? null,
      }))
      .sort((a: any, b: any) => a.project_name.localeCompare(b.project_name)),
    links: user.user_links
      .map((link: any) => ({
        name_: link.name_,
        link: link.link,
      }))
      .sort((a: any, b: any) => a.name_.localeCompare(b.name_)),
  });
}

async function assertSkillIdsExist(skillIds: number[]) {
  const count = await prisma.skills.count({
    where: { skill_id: { in: skillIds } },
  });

  if (count !== skillIds.length) {
    throw new AppError("One or more skill IDs are invalid", 400);
  }
}

async function assertInterestIdsExist(interestIds: number[]) {
  const count = await prisma.interests.count({
    where: { interest_id: { in: interestIds } },
  });

  if (count !== interestIds.length) {
    throw new AppError("One or more interest IDs are invalid", 400);
  }
}

async function assertYearIdExists(yearId: number) {
  const count = await prisma.years.count({
    where: { year_id: yearId },
  });

  if (count !== 1) {
    throw new AppError("yearId is invalid", 400);
  }
}

async function assertMajorIdExists(majorId: number) {
  const count = await prisma.majors.count({
    where: { major_id: majorId },
  });

  if (count !== 1) {
    throw new AppError("majorId is invalid", 400);
  }
}

async function assertPreferredMajorIdsExist(majorIds: number[]) {
  if (majorIds.length === 0) return;

  const count = await prisma.majors.count({
    where: { major_id: { in: majorIds } },
  });

  if (count !== majorIds.length) {
    throw new AppError("One or more preferred major IDs are invalid", 400);
  }
}

async function assertPreferredSkillIdsExist(skillIds: number[]) {
  if (skillIds.length === 0) return;
  await assertSkillIdsExist(skillIds);
}

async function assertPreferredInterestIdsExist(interestIds: number[]) {
  if (interestIds.length === 0) return;
  await assertInterestIdsExist(interestIds);
}

async function getProfileRecord(
  userId: number,
  client: PrismaExecutor = prisma,
) {
  return client.users.findUnique({
    where: { user_id: userId },
    include: {
      years: true,
      majors: true,
      user_skills: {
        include: { skills: true },
      },
      user_interests: {
        include: { interests: true },
      },
      major_preferences: true,
      skills_preferences: true,
      interests_preferences: true,
      user_projects: true,
      user_links: true,
    },
  });
}

export async function updateMyProfile(userId: number, payload: UpdateProfilePayload) {
  const fullName = toOptionalText(payload.fullName, "fullName");
  const yearId = normalizeOptionalId(payload.yearId, "yearId");
  const majorId = normalizeOptionalId(payload.majorId, "majorId");
  const bio = toOptionalText(payload.bio, "bio");
  const fypIdea = toOptionalText(payload.fypIdea, "fypIdea");
  const profilePicture = toOptionalText(payload.profilePicture, "profilePicture");
  const skills = normalizeIdArray(payload.skills, "skills");
  const interests = normalizeIdArray(payload.interests, "interests");
  const preferredMajorIds = normalizeOptionalIdArray(payload.preferredMajorIds, "preferredMajorIds");
  const preferredSkillIds = normalizeOptionalIdArray(payload.preferredSkillIds, "preferredSkillIds");
  const preferredInterestIds = normalizeOptionalIdArray(payload.preferredInterestIds, "preferredInterestIds");
  const projects = normalizeProjects(payload.projects);
  const links = normalizeLinks(payload.links);

  if (
    fullName === undefined &&
    yearId === undefined &&
    majorId === undefined &&
    bio === undefined &&
    fypIdea === undefined &&
    profilePicture === undefined &&
    skills === undefined &&
    interests === undefined &&
    preferredMajorIds === undefined &&
    preferredSkillIds === undefined &&
    preferredInterestIds === undefined &&
    projects === undefined &&
    links === undefined
  ) {
    throw new AppError("At least one field must be provided for update", 400);
  }

  await Promise.all([
    yearId !== undefined ? assertYearIdExists(yearId) : Promise.resolve(),
    majorId !== undefined ? assertMajorIdExists(majorId) : Promise.resolve(),
    skills !== undefined ? assertSkillIdsExist(skills) : Promise.resolve(),
    interests !== undefined ? assertInterestIdsExist(interests) : Promise.resolve(),
    preferredMajorIds !== undefined
      ? assertPreferredMajorIdsExist(preferredMajorIds)
      : Promise.resolve(),
    preferredSkillIds !== undefined
      ? assertPreferredSkillIdsExist(preferredSkillIds)
      : Promise.resolve(),
    preferredInterestIds !== undefined
      ? assertPreferredInterestIdsExist(preferredInterestIds)
      : Promise.resolve(),
  ]);

  return prisma.$transaction(async (tx) => {
    const existing = await getProfileRecord(userId, tx);

    if (!existing || existing.account_status !== "active") {
      throw new AppError("User not found", 404);
    }

    if (!isProfileComplete(existing)) {
      throw new AppError("Profile not yet created", 404);
    }

    if (fullName !== undefined && !fullName) {
      throw new AppError("fullName cannot be empty", 400);
    }

    const beforeSnapshot = snapshotKeyFields(existing);

    const mergedLinks = (() => {
      if (links === undefined) return null;

      const current = buildLinksObject(existing.user_links);
      const next: Record<string, string> = { ...current };

      for (const key of LINK_NAMES) {
        if (!(key in links)) continue;

        const value = links[key];
        if (!value) {
          delete next[key];
        } else {
          next[key] = value;
        }
      }

      return next;
    })();

    const userUpdateData: Record<string, unknown> = {};

    if (fullName !== undefined) userUpdateData.full_name = fullName;
    if (yearId !== undefined) userUpdateData.year = yearId;
    if (majorId !== undefined) userUpdateData.major = majorId;
    if (bio !== undefined) userUpdateData.biography = bio;
    if (fypIdea !== undefined) userUpdateData.ideas = fypIdea;
    if (profilePicture !== undefined) userUpdateData.profile_pic = profilePicture;

    if (Object.keys(userUpdateData).length > 0) {
      await tx.users.update({
        where: { user_id: userId },
        data: userUpdateData,
      });
    }

    if (skills !== undefined) {
      await tx.user_skills.deleteMany({ where: { user_id: userId } });
      await tx.user_skills.createMany({
        data: skills.map((skillId) => ({
          user_id: userId,
          skill_id: skillId,
        })),
      });
    }

    if (interests !== undefined) {
      await tx.user_interests.deleteMany({ where: { user_id: userId } });
      await tx.user_interests.createMany({
        data: interests.map((interestId) => ({
          user_id: userId,
          interest_id: interestId,
        })),
      });
    }

    if (preferredMajorIds !== undefined) {
      await tx.major_preferences.deleteMany({ where: { user_id: userId } });
      if (preferredMajorIds.length > 0) {
        await tx.major_preferences.createMany({
          data: preferredMajorIds.map((preferredMajorId) => ({
            user_id: userId,
            preferred_major_id: preferredMajorId,
          })),
        });
      }
    }

    if (preferredSkillIds !== undefined) {
      await tx.skills_preferences.deleteMany({ where: { user_id: userId } });
      if (preferredSkillIds.length > 0) {
        await tx.skills_preferences.createMany({
          data: preferredSkillIds.map((preferredSkillId) => ({
            user_id: userId,
            preferred_skill_id: preferredSkillId,
          })),
        });
      }
    }

    if (preferredInterestIds !== undefined) {
      await tx.interests_preferences.deleteMany({ where: { user_id: userId } });
      if (preferredInterestIds.length > 0) {
        await tx.interests_preferences.createMany({
          data: preferredInterestIds.map((preferredInterestId) => ({
            user_id: userId,
            preferred_interest_id: preferredInterestId,
          })),
        });
      }
    }

    if (projects !== undefined) {
      await tx.user_projects.deleteMany({ where: { user_id: userId } });
      if (projects.length > 0) {
        await tx.user_projects.createMany({
          data: projects.map((project) => ({
            user_id: userId,
            project_name: project.project_name,
            project_link: project.project_link ?? null,
          })),
        });
      }
    }

    if (mergedLinks !== null) {
      await tx.user_links.deleteMany({ where: { user_id: userId } });

      const nextLinks = Object.entries(mergedLinks);
      if (nextLinks.length > 0) {
        await tx.user_links.createMany({
          data: nextLinks.map(([name_, link]) => ({
            user_id: userId,
            name_,
            link,
          })),
        });
      }
    }

    const updated = await getProfileRecord(userId, tx);

    if (!updated) {
      throw new AppError("Profile update failed", 500);
    }

    if (!isProfileComplete(updated)) {
      throw new AppError(
        "Profile must still include full name, year, major, at least one skill, and at least one interest",
        400,
      );
    }

    const afterSnapshot = snapshotKeyFields(updated);
    const keyFieldsChanged = beforeSnapshot !== afterSnapshot;

    let profileUpdatedNotificationsSent = false;

    if (keyFieldsChanged) {
      const now = new Date();

      await tx.users.update({
        where: { user_id: userId },
        data: { profile_updated_at: now },
      });

      const activeMatches = await tx.matches.findMany({
        where: {
          status: "active",
          OR: [{ user1_id: userId }, { user2_id: userId }],
        },
        select: {
          match_id: true,
          user1_id: true,
          user2_id: true,
        },
      });

      if (activeMatches.length > 0) {
        await tx.notifications.createMany({
          data: activeMatches.map((match) => ({
            user_id: match.user1_id === userId ? match.user2_id : match.user1_id,
            match_id: match.match_id,
            type: "PROFILE_UPDATED",
          })),
        });

        profileUpdatedNotificationsSent = true;
      }

      return {
        updatedAt: now,
        profileUpdatedNotificationsSent,
      };
    }

    return {
      updatedAt: updated.profile_updated_at ?? updated.created_at,
      profileUpdatedNotificationsSent,
    };
  }, {
    maxWait: 10000,
    timeout: 15000,
  });
}
