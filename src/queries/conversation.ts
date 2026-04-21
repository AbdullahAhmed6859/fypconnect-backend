import { prisma } from "../db/prisma.js";
import AppError from "../utils/appError.js";

const MAX_MESSAGE_LENGTH = 1000;

type SendMessageResult = {
  messageId: number;
  matchId: number;
  senderId: number;
  content: string;
  timestamp: Date;
  recipientUnreadUpdated: boolean;
};

type ConversationMessage = {
  messageId: number;
  senderId: number | null;
  content: string;
  timestamp: Date;
};

type GetConversationResult = {
  matchId: number;
  matchedUser: {
    userId: number;
    fullName: string | null;
  };
  messages: ConversationMessage[];
  indicatorsCleared: {
    newMatch: boolean;
    newMessage: boolean;
  };
};

function normalizeMatchId(value: unknown) {
  const matchId = Number(value);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new AppError("matchId must be a valid integer", 400);
  }

  return matchId;
}

function normalizeContent(value: unknown) {
  if (typeof value !== "string") {
    throw new AppError("Unsupported message type", 400);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new AppError("Message content cannot be empty", 400);
  }

  if (value.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(
      `Message content exceeds ${MAX_MESSAGE_LENGTH} characters`,
      400
    );
  }

  return value;
}

export function normalizeSendMessageInput(
  currentUserId: number,
  matchIdParam: unknown,
  payload: Record<string, unknown>
) {
  return {
    currentUserId,
    matchId: normalizeMatchId(matchIdParam),
    content: normalizeContent(payload?.content),
  };
}

export function normalizeGetConversationInput(
  currentUserId: number,
  matchIdParam: unknown
) {
  return {
    currentUserId,
    matchId: normalizeMatchId(matchIdParam),
  };
}

export async function sendMessage(
  currentUserId: number,
  matchId: number,
  content: string
): Promise<SendMessageResult> {
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
      throw new AppError("Not an active match", 403);
    }

    if (match.status !== "active") {
      throw new AppError("Not an active match", 403);
    }

    const createdMessage = await tx.messages.create({
      data: {
        match_id: matchId,
        sender_id: currentUserId,
        message: content,
      },
      select: {
        message_id: true,
        match_id: true,
        sender_id: true,
        message: true,
        created_at: true,
        unread: true,
      },
    });

    return {
      messageId: createdMessage.message_id,
      matchId: createdMessage.match_id,
      senderId: currentUserId,
      content: createdMessage.message,
      timestamp: createdMessage.created_at,
      recipientUnreadUpdated: createdMessage.unread,
    };
  });
}

export async function getConversation(
  currentUserId: number,
  matchId: number
): Promise<GetConversationResult> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.matches.findUnique({
      where: { match_id: matchId },
      select: {
        match_id: true,
        user1_id: true,
        user2_id: true,
        status: true,
        users_matches_user1_idTousers: {
          select: {
            user_id: true,
            full_name: true,
          },
        },
        users_matches_user2_idTousers: {
          select: {
            user_id: true,
            full_name: true,
          },
        },
      },
    });

    if (!match) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant =
      match.user1_id === currentUserId || match.user2_id === currentUserId;

    if (!isParticipant) {
      throw new AppError("Conversation not found", 404);
    }

    if (match.status !== "active") {
      throw new AppError("Not an active match", 403);
    }

    const matchedUser =
      match.user1_id === currentUserId
        ? match.users_matches_user2_idTousers
        : match.users_matches_user1_idTousers;

    const messages = await tx.messages.findMany({
      where: { match_id: matchId },
      orderBy: { created_at: "asc" },
      select: {
        message_id: true,
        sender_id: true,
        message: true,
        created_at: true,
      },
    });

    const [clearedMatch, clearedMessageNotifications, clearedUnread] =
      await Promise.all([
        tx.notifications.updateMany({
          where: {
            match_id: matchId,
            user_id: currentUserId,
            type: "NEW_MATCH",
            read: false,
          },
          data: { read: true },
        }),
        tx.notifications.updateMany({
          where: {
            match_id: matchId,
            user_id: currentUserId,
            type: "NEW_MESSAGE",
            read: false,
          },
          data: { read: true },
        }),
        tx.messages.updateMany({
          where: {
            match_id: matchId,
            unread: true,
            OR: [
              { sender_id: null },
              { sender_id: { not: currentUserId } },
            ],
          },
          data: { unread: false },
        }),
      ]);

    return {
      matchId: match.match_id,
      matchedUser: {
        userId: matchedUser.user_id,
        fullName: matchedUser.full_name,
      },
      messages: messages.map((m) => ({
        messageId: m.message_id,
        senderId: m.sender_id,
        content: m.message,
        timestamp: m.created_at,
      })),
      indicatorsCleared: {
        newMatch: clearedMatch.count > 0,
        newMessage:
          clearedMessageNotifications.count > 0 || clearedUnread.count > 0,
      },
    };
  });
}
