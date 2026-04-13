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
  skills?: number[];
  interests?: number[];
  bio?: string | null;
  projects?: ProjectInput[];
  fypIdea?: string | null;
  links?: LinkPatch;
  profilePicture?: string | null;
};

const LINK_NAMES: AllowedLinkName[] = ["github", "linkedin", "portfolio"];

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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

function yearLabel(yearNumber: number | null | undefined) {
  if (yearNumber === 1) return "Freshman";
  if (yearNumber === 2) return "Sophomore";
  if (yearNumber === 3) return "Junior";
  if (yearNumber === 4) return "Senior";
  return yearNumber ? String(yearNumber) : null;
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
    skills: user.user_skills
      .map((item: any) => item.skill_id)
      .sort((a: number, b: number) => a - b),
    interests: user.user_interests
      .map((item: any) => item.interest_id)
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
      user_projects: true,
      user_links: true,
    },
  });
}

export async function getMyProfile(userId: number) {
  const user = await getProfileRecord(userId);

  if (!user || user.account_status !== "active") {
    throw new AppError("User not found", 404);
  }

  if (!isProfileComplete(user)) {
    throw new AppError("Profile not yet created", 404);
  }

  return {
    id: user.user_id,
    fullName: user.full_name,
    yearOfStudy: yearLabel(user.years?.year),
    major: user.majors?.majors ?? null,
    skills: user.user_skills.map((item) => item.skills.skill),
    interests: user.user_interests.map((item) => item.interests.interest),
    bio: user.biography,
    projects: user.user_projects.map((project) => ({
      project_name: project.project_name,
      project_link: project.project_link,
    })),
    links: buildLinksObject(user.user_links),
    fypIdea: user.ideas,
    profilePicture: user.profile_pic,
    profileCompleted: true,
    createdAt: user.created_at,
    updatedAt: user.profile_updated_at ?? user.created_at,
  };
}

export async function updateMyProfile(userId: number, payload: UpdateProfilePayload) {
  const fullName = toOptionalText(payload.fullName, "fullName");
  const bio = toOptionalText(payload.bio, "bio");
  const fypIdea = toOptionalText(payload.fypIdea, "fypIdea");
  const profilePicture = toOptionalText(payload.profilePicture, "profilePicture");
  const skills = normalizeIdArray(payload.skills, "skills");
  const interests = normalizeIdArray(payload.interests, "interests");
  const projects = normalizeProjects(payload.projects);
  const links = normalizeLinks(payload.links);

  if (
    fullName === undefined &&
    bio === undefined &&
    fypIdea === undefined &&
    profilePicture === undefined &&
    skills === undefined &&
    interests === undefined &&
    projects === undefined &&
    links === undefined
  ) {
    throw new AppError("At least one field must be provided for update", 400);
  }

  if (skills) {
    await assertSkillIdsExist(skills);
  }

  if (interests) {
    await assertInterestIdsExist(interests);
  }

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
  });
}
