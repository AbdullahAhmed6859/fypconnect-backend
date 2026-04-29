import { prisma } from "../db/prisma.js";
import {
    account_status_enum,
    Prisma,
} from "../generated/prisma/client";
import AppError from "../utils/appError";

type ProjectInput = {
    project_name: string;
    project_link?: string | null;
};

type LinksInput = {
    github?: string;
    linkedin?: string;
    portfolio?: string;
};

export type ProfileSetupInput = {
    userId: number;
    fullName: string;
    yearId: number;
    majorId: number;
    skills: number[];
    interests: number[];
    preferredMajorIds?: number[];
    preferredSkillIds?: number[];
    preferredInterestIds?: number[];
    bio?: string | null;
    projects?: ProjectInput[];
    links?: LinksInput;
    fypIdea?: string | null;
    profilePicture?: string | null;
};


type PreferencesInput = {
    userId: number;
    preferredMajorIds: number[];
    preferredSkillIds?: number[];
    preferredInterestIds?: number[];
};

function normalizeRequiredIdArray(value: unknown, field: string): number[] {
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

async function assertMajorIdsExist(
    tx: Prisma.TransactionClient,
    majorIds: number[]
) {
    const count = await tx.majors.count({
        where: { major_id: { in: majorIds } },
    });

    if (count !== majorIds.length) {
        throw new AppError("One or more preferred major IDs are invalid", 400);
    }
}

async function assertSkillIdsExist(
    tx: Prisma.TransactionClient,
    skillIds: number[]
) {
    if (skillIds.length === 0) return;

    const count = await tx.skills.count({
        where: { skill_id: { in: skillIds } },
    });

    if (count !== skillIds.length) {
        throw new AppError("One or more preferred skill IDs are invalid", 400);
    }
}

async function assertInterestIdsExist(
    tx: Prisma.TransactionClient,
    interestIds: number[]
) {
    if (interestIds.length === 0) return;

    const count = await tx.interests.count({
        where: { interest_id: { in: interestIds } },
    });

    if (count !== interestIds.length) {
        throw new AppError("One or more preferred interest IDs are invalid", 400);
    }
}

function normalizeLinks(
    links?: LinksInput
): { name_: string; link: string }[] {
    if (!links) return [];

    const entries: { name_: string; link: string }[] = [];

    if (links.github) {
        entries.push({ name_: "github", link: links.github });
    }
    if (links.linkedin) {
        entries.push({ name_: "linkedin", link: links.linkedin });
    }
    if (links.portfolio) {
        entries.push({ name_: "portfolio", link: links.portfolio });
    }

    return entries;
}

function isNullish(value: unknown) {
    return value === undefined || value === null;
}

async function getYearValueById(yearId: number): Promise<number | null> {
    const yearRecord = await prisma.years.findUnique({
        where: { year_id: yearId },
        select: { year: true },
    });

    return yearRecord?.year ?? null;
}

function getAnnualYearReviewState(
    profileCompletedAt?: Date | null,
    dismissedYear?: number | null
) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentYearReviewDate = new Date(currentYear, 7, 1);
    const reviewYear = now >= currentYearReviewDate
        ? currentYear
        : currentYear - 1;
    const reviewDate = new Date(reviewYear, 7, 1);
    const reviewHasPassedSinceSetup = profileCompletedAt
        ? reviewDate > profileCompletedAt
        : false;

    return {
        required: reviewHasPassedSinceSetup && dismissedYear !== reviewYear,
        reviewDate: `August 1, ${reviewYear}`,
        reviewYear,
        dismissedYear: dismissedYear ?? null,
    };
}

export function getCurrentAnnualYearReviewYear() {
    return getAnnualYearReviewState(null).reviewYear;
}

export async function getProfile(userId: number) {
    const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: {
        user_id: true,
        full_name: true,
        profile_pic: true,
        biography: true,
        ideas: true,
        account_status: true,
        created_at: true,
        profile_updated_at: true,
        profile_completed_at: true,
        annual_year_review_dismissed_year: true,
        years: {
            select: {
            year_id: true,
            year: true,
            },
        },
        majors: {
            select: {
            major_id: true,
            majors: true,
            },
        },
        user_skills: {
            select: {
            skills: {
                select: {
                skill_id: true,
                skill: true,
                },
            },
            },
        },
        user_interests: {
            select: {
            interests: {
                select: {
                interest_id: true,
                interest: true,
                },
            },
            },
        },
        user_projects: {
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

    if (!user) return null;

    const links = user.user_links.reduce<Record<string, string>>((acc, item) => {
        acc[item.name_] = item.link;
        return acc;
    }, {});

    const profileCompleted = Boolean(
        user.full_name && user.years?.year_id && user.majors?.major_id && 
        user.account_status == account_status_enum.active
    );

    return {
        data: {
        id: user.user_id,
        fullName: user.full_name,
        yearOfStudy: user.years
            ? String(user.years.year)
            : null,
        major: user.majors?.majors ?? null,
        skills: user.user_skills.map((item) => item.skills.skill),
        interests: user.user_interests.map((item) => item.interests.interest),
        bio: user.biography,
        projects: user.user_projects,
        links,
        fypIdea: user.ideas,
        profilePicture: user.profile_pic,
        profileCompleted,
        annualYearReview: getAnnualYearReviewState(
            user.profile_completed_at ?? user.profile_updated_at ?? user.created_at,
            user.annual_year_review_dismissed_year
        ),
        createdAt: user.created_at,
        profileCompletedAt: user.profile_completed_at ?? null,
        updatedAt: user.profile_updated_at ?? user.created_at,
        },
    };
}

export async function dismissAnnualYearReview(userId: number) {
    const reviewYear = getCurrentAnnualYearReviewYear();

    await prisma.users.update({
        where: { user_id: userId },
        data: {
            annual_year_review_dismissed_year: reviewYear,
        },
    });

    return getAnnualYearReviewState(null, reviewYear);
}

export async function profileSetup(input: ProfileSetupInput) {
    const {
        userId,
        fullName,
        yearId,
        majorId,
        skills,
        interests,
        preferredMajorIds = [],
        preferredSkillIds = [],
        preferredInterestIds = [],
        bio = null,
        projects = [],
        links,
        fypIdea = null,
        profilePicture = null,
    } = input;

    const yearValue = await getYearValueById(yearId);
    const eligibleForBrowsing =
        yearValue !== null ? yearValue >= 3 : false;

    return prisma.$transaction(async (tx) => {
        const existingUser = await tx.users.findUnique({
        where: { user_id: userId },
        select: {
            user_id: true,
            full_name: true,
            year: true,
            major: true,
        },
        });

        if (!existingUser) {
        throw new Error("User not found");
        }

        const alreadyCompleted = Boolean(
            existingUser.full_name && existingUser.year && existingUser.major
        );

        if (alreadyCompleted) {
            throw new Error("Profile setup already completed");
        }

        const now = new Date();

        await tx.users.update({
        where: { user_id: userId },
        data: {
            full_name: fullName,
            year: yearId,
            major: majorId,
            profile_pic: profilePicture,
            biography: bio,
            ideas: fypIdea,
            account_status: account_status_enum.active,
            profile_updated_at: now,
            profile_completed_at: now,
        },
        });

        await tx.user_skills.createMany({
        data: skills.map((skillId) => ({
            user_id: userId,
            skill_id: skillId,
        })),
        });

        await tx.user_interests.createMany({
        data: interests.map((interestId) => ({
            user_id: userId,
            interest_id: interestId,
        })),
        });

        if (projects.length > 0) {
        await tx.user_projects.createMany({
            data: projects.map((project) => ({
            user_id: userId,
            project_name: project.project_name,
            project_link: project.project_link ?? null,
            })),
        });
        }

        const normalizedLinks = normalizeLinks(links);
        if (normalizedLinks.length > 0) {
        await tx.user_links.createMany({
            data: normalizedLinks.map((item) => ({
            user_id: userId,
            name_: item.name_,
            link: item.link,
            })),
        });
        }

        if (preferredMajorIds.length > 0) {
        await tx.major_preferences.createMany({
            data: preferredMajorIds.map((preferredMajorId) => ({
            user_id: userId,
            preferred_major_id: preferredMajorId,
            })),
        });
        }

        if (preferredSkillIds.length > 0) {
        await tx.skills_preferences.createMany({
            data: preferredSkillIds.map((preferredSkillId) => ({
            user_id: userId,
            preferred_skill_id: preferredSkillId,
            })),
        });
        }

        if (preferredInterestIds.length > 0) {
        await tx.interests_preferences.createMany({
            data: preferredInterestIds.map((preferredInterestId) => ({
            user_id: userId,
            preferred_interest_id: preferredInterestId,
            })),
        });
        }

        return {
        message: "Profile setup completed successfully",
        data: {
            profileId: userId,
            profileCompleted: true,
            eligibleForBrowsing,
        },
        };
    }, { timeout: 15000 });
}

export async function getPreferences(userId: number) {
    const [majorPrefs, skillPrefs, interestPrefs] = await prisma.$transaction([
        prisma.major_preferences.findMany({
        where: { user_id: userId },
        select: { preferred_major_id: true },
        orderBy: { major_preference_id: "asc" },
        }),
        prisma.skills_preferences.findMany({
        where: { user_id: userId },
        select: { preferred_skill_id: true },
        orderBy: { skill_preference_id: "asc" },
        }),
        prisma.interests_preferences.findMany({
        where: { user_id: userId },
        select: { preferred_interest_id: true },
        orderBy: { interest_preference_id: "asc" },
        }),
    ]);

    const hasPreferences =
        majorPrefs.length > 0 || skillPrefs.length > 0 || interestPrefs.length > 0;

    if (!hasPreferences) {
        return null;
    }

    const updatedAt = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { profile_updated_at: true },
    });

    return {
        data: {
        preferredMajorIds: majorPrefs.map((item) => item.preferred_major_id),
        preferredSkillIds: skillPrefs.map((item) => item.preferred_skill_id),
        preferredInterestIds: interestPrefs.map(
            (item) => item.preferred_interest_id
        ),
        updatedAt: updatedAt?.profile_updated_at ?? null,
        },
    };
}

export async function savePreferences(input: PreferencesInput) {
    const {
        userId,
        preferredMajorIds,
        preferredSkillIds = [],
        preferredInterestIds = [],
    } = input;

    return prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
        where: { user_id: userId },
        select: {
        user_id: true,
        full_name: true,
        year: true,
        major: true,
        account_status: true,
        },
    });

    if (!user || user.account_status !== account_status_enum.active) {
        throw new AppError("User not found", 404);
    }

    const profileCompleted = Boolean(user.full_name && user.year && user.major);

    if (!profileCompleted) {
        throw new AppError("Profile not yet created", 404);
    }

    await Promise.all([
        assertMajorIdsExist(tx, preferredMajorIds),
        assertSkillIdsExist(tx, preferredSkillIds),
        assertInterestIdsExist(tx, preferredInterestIds),
    ]);

    await tx.major_preferences.deleteMany({
        where: { user_id: userId },
    });

    await tx.skills_preferences.deleteMany({
        where: { user_id: userId },
    });

    await tx.interests_preferences.deleteMany({
        where: { user_id: userId },
    });

    await tx.major_preferences.createMany({
        data: preferredMajorIds.map((majorId) => ({
        user_id: userId,
        preferred_major_id: majorId,
        })),
    });

    if (preferredSkillIds.length > 0) {
        await tx.skills_preferences.createMany({
        data: preferredSkillIds.map((skillId) => ({
            user_id: userId,
            preferred_skill_id: skillId,
        })),
        });
    }

    if (preferredInterestIds.length > 0) {
        await tx.interests_preferences.createMany({
        data: preferredInterestIds.map((interestId) => ({
            user_id: userId,
            preferred_interest_id: interestId,
        })),
        });
    }

    await tx.users.update({
        where: { user_id: userId },
        data: {
        profile_updated_at: new Date(),
        },
    });

    return {
        message: "Preferences saved successfully",
        data: {
        preferredMajorIds,
        preferredSkillIds,
        preferredInterestIds,
        },
    };
    });
}

export function normalizePreferencesInput(payload: Record<string, unknown>): PreferencesInput {
    return {
        userId: Number(payload.userId),
        preferredMajorIds: normalizeRequiredIdArray(
            payload.preferredMajorIds,
            "preferredMajorIds"
        ),
        preferredSkillIds:
            normalizeOptionalIdArray(payload.preferredSkillIds, "preferredSkillIds") ?? [],
        preferredInterestIds:
            normalizeOptionalIdArray(payload.preferredInterestIds, "preferredInterestIds") ?? [],
    };
}

export async function getSkillsAndInterests() {
    try {
        const [years, majors, skills, interests] = await prisma.$transaction([
            prisma.years.findMany({
                select: { year_id: true, year: true },
                orderBy: { year: "asc" },
            }),
            prisma.majors.findMany({
                select: { major_id: true, majors: true },
                orderBy: { majors: "asc" },
            }),
            prisma.skills.findMany({
                select: {
                    skill_id: true,
                    skill: true,
                    _count: {
                        select: {
                            user_skills: {
                                where: {
                                    users: {
                                        account_status: account_status_enum.active,
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { skill_id: "asc" },
            }),
            prisma.interests.findMany({
                select: {
                    interest_id: true,
                    interest: true,
                    _count: {
                        select: {
                            user_interests: {
                                where: {
                                    users: {
                                        account_status: account_status_enum.active,
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { interest_id: "asc" },
            }),
        ]);

        return {
            data: {
                years: years.map((item) => ({
                    id: item.year_id,
                    name: `Year ${item.year}`,
                    value: item.year,
                })),
                majors: majors.map((item) => ({
                    id: item.major_id,
                    name: item.majors,
                })),
                skills: skills.map((item) => ({
                    id: item.skill_id,
                    name: item.skill,
                    userCount: item._count.user_skills,
                })),
                interests: interests.map((item) => ({
                    id: item.interest_id,
                    name: item.interest,
                    userCount: item._count.user_interests,
                })),
            },
        };
    } catch (error) {
        throw new AppError("Failed to retrieve profile setup options", 500);
    }
}

