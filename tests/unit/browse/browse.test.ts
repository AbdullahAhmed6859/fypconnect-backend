process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma.js", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { prisma } from "../../../src/db/prisma.js";
import { likeProfile, passProfile } from "../../../src/queries/browse";

describe("browse actions", () => {
  const transactionMock = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;
  const currentUser = {
    user_id: 1,
    account_status: "active",
    year: 3,
    skills_preferences: [{ preferred_skill_id: 1 }],
    interests_preferences: [],
  };
  const targetUser = {
    user_id: 2,
    account_status: "active",
    full_name: "Target User",
    year: 3,
    major: 1,
    user_skills: [{ skill_id: 1 }],
    user_interests: [],
  };

  test("rejects a duplicate like", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentUser)
          .mockResolvedValueOnce(targetUser),
      },
      blocked_users: { findFirst: jest.fn().mockResolvedValue(null) },
      matches: { findFirst: jest.fn().mockResolvedValue(null) },
      likes: { findFirst: jest.fn().mockResolvedValue({ like_id: 5 }) },
      passes: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(likeProfile(1, 2)).rejects.toMatchObject({
      message: "Profile already liked",
      statusCode: 409,
    });
  });

  test("rejects a duplicate pass", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentUser)
          .mockResolvedValueOnce(targetUser),
      },
      blocked_users: { findFirst: jest.fn().mockResolvedValue(null) },
      matches: { findFirst: jest.fn().mockResolvedValue(null) },
      likes: { findFirst: jest.fn().mockResolvedValue(null) },
      passes: { findFirst: jest.fn().mockResolvedValue({ pass_id: 6 }) },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(passProfile(1, 2)).rejects.toMatchObject({
      message: "Profile already passed",
      statusCode: 409,
    });
  });

  test("creates a mutual match atomically", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentUser)
          .mockResolvedValueOnce(targetUser),
      },
      blocked_users: { findFirst: jest.fn().mockResolvedValue(null) },
      matches: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          match_id: 10,
          created_at: new Date("2026-04-29T00:00:00.000Z"),
        }),
      },
      likes: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ like_id: 99 }),
        create: jest.fn().mockResolvedValue({
          created_at: new Date("2026-04-29T00:00:00.000Z"),
        }),
      },
      passes: { findFirst: jest.fn().mockResolvedValue(null) },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await likeProfile(1, 2);

    expect(result).toEqual({
      isMutualMatch: true,
      likedAt: new Date("2026-04-29T00:00:00.000Z"),
      match: {
        matchId: 10,
        createdAt: new Date("2026-04-29T00:00:00.000Z"),
      },
    });
    expect(tx.matches.create).toHaveBeenCalledTimes(1);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        { user_id: 1, match_id: 10, type: "NEW_MATCH" },
        { user_id: 2, match_id: 10, type: "NEW_MATCH" },
      ],
    });
  });
});
