import { prisma } from "../db/prisma.js";


type MatchListItem = {
  matchId: number;
  matchedUser: {
    userId: number;
    fullName: string | null;
    major: string | null;
    yearOfStudy: number | null;
    profilePicture: string | null;
  };
  createdAt: Date;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  hasUnreadMessages: boolean;
  isNewMatch: boolean;
  hasProfileUpdated: boolean;
};

export async function getActiveMatchesForUser(
  currentUserId: number
): Promise<MatchListItem[]> {
  const matches = await prisma.matches.findMany({
    where: {
      status: "active",
      OR: [{ user1_id: currentUserId }, { user2_id: currentUserId }],
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      match_id: true,
      user1_id: true,
      user2_id: true,
      created_at: true,

      users_matches_user1_idTousers: {
        select: {
          user_id: true,
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

      users_matches_user2_idTousers: {
        select: {
          user_id: true,
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

      messages: {
        orderBy: {
          created_at: "desc",
        },
        take: 1,
        select: {
          message: true,
          created_at: true,
        },
      },

      notifications: {
        where: {
          user_id: currentUserId,
          read: false,
          type: {
            in: ["NEW_MATCH", "PROFILE_UPDATED"],
          },
        },
        select: {
          type: true,
        },
      },
    },
  });

  const result = await Promise.all(
    matches.map(async (match) => {
      const matchedUser =
        match.user1_id === currentUserId
          ? match.users_matches_user2_idTousers
          : match.users_matches_user1_idTousers;

      const unreadMessage = await prisma.messages.findFirst({
        where: {
          match_id: match.match_id,
          unread: true,
          OR: [
            { sender_id: null },
            { sender_id: { not: currentUserId } },
          ],
        },
        select: {
          message_id: true,
        },
      });

      const latestMessage = match.messages[0] ?? null;

      return {
        matchId: match.match_id,
        matchedUser: {
          userId: matchedUser.user_id,
          fullName: matchedUser.full_name,
          major: matchedUser.majors?.majors ?? null,
          yearOfStudy: matchedUser.years?.year ?? null,
          profilePicture: matchedUser.profile_pic ?? null,
        },
        createdAt: match.created_at,
        lastMessagePreview: latestMessage?.message ?? null,
        lastMessageAt: latestMessage?.created_at ?? null,
        hasUnreadMessages: Boolean(unreadMessage),
        isNewMatch: match.notifications.some((n) => n.type === "NEW_MATCH"),
        hasProfileUpdated: match.notifications.some(
          (n) => n.type === "PROFILE_UPDATED"
        ),
      };
    })
  );

  return result;
}