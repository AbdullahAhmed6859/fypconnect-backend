import { prisma } from "../db/prisma";
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

async function getYearValueById(
    tx: Prisma.TransactionClient,
    yearId: number
    ): Promise<number | null> {
    const yearRecord = await tx.years.findUnique({
        where: { year_id: yearId },
        select: { year: true },
    });

    return yearRecord?.year ?? null;
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
        createdAt: user.created_at,
        updatedAt: user.profile_updated_at ?? user.created_at,
        },
    };
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
            profile_updated_at: new Date(),
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

        const profileId = userId;
        const yearValue = await getYearValueById(tx, yearId);
        const eligibleForBrowsing =
        yearValue !== null ? yearValue >= 3 : false;

        return {
        message: "Profile setup completed successfully",
        data: {
            profileId,
            profileCompleted: true,
            eligibleForBrowsing,
        },
        };
    });
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
