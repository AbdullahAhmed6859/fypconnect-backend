import { prisma } from "../db/prisma.js";

type UpdatedProfileResult = {
    matchId: number;
    updatedUser: {
        userId: number;
        fullName: string | null;
        major: string | null;
        year: number | null;
        skills: string[];
        interests: string[];
        biography: string | null;
        projects: Array<{
        project_link: string | null;
        project_name: string;
        }>;
        links: Record<string, string>;
        ideas: string | null;
    };
    indicatorCleared: boolean;
};

type AppError = Error & { statusCode?: number };

export async function getUpdatedProfileForMatch(
    currentUserId: number,
    matchId: number
    ): Promise<UpdatedProfileResult> {
    return prisma.$transaction(async (tx) => {
        const match = await tx.matches.findUnique({
        where: { match_id: matchId },
        select: {
            match_id: true,
            user1_id: true,
            user2_id: true,
        },
        });

        if (!match) {
            const error: AppError = new Error("Match not found");
            error.statusCode = 404;
            throw error;
        }

        if (match.user1_id !== currentUserId && match.user2_id !== currentUserId) {
            const error: AppError = new Error("User is not a participant in this match");
            error.statusCode = 403;
            throw error;
        }

        const updatedUserId = match.user1_id === currentUserId ? match.user2_id : match.user1_id;

        const user = await tx.users.findUnique({
        where: { user_id: updatedUserId },
        select: {
            user_id: true,
            full_name: true,
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
            select: {
                project_link: true,
                project_name: true,
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

        if (!user) {
            const error: AppError = new Error("Matched user not found");
            error.statusCode = 404;
            throw error;
        }

        const cleared = await tx.notifications.updateMany({
        where: {
            match_id: matchId,
            user_id: currentUserId,
            type: "PROFILE_UPDATED",
            read: false,
        },
        data: {
            read: true,
        },
        });

        const links = Object.fromEntries(
            user.user_links.map((item) => [item.name_, item.link])
        );

        return {
        matchId: match.match_id,
        updatedUser: {
            userId: user.user_id,
            fullName: user.full_name,
            major: user.majors?.majors ?? null,
            year: user.years?.year ?? null,
            skills: user.user_skills.map((item) => item.skills.skill),
            interests: user.user_interests.map((item) => item.interests.interest),
            biography: user.biography,
            projects: user.user_projects,
            links,
            ideas: user.ideas,
        },
        indicatorCleared: cleared.count > 0,
        };
    });
}