process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma.js", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { prisma } from "../../../src/db/prisma.js";
import { likeProfile } from "../../../src/queries/browse";
import { blockUser, deleteMyAccount, unmatchUser } from "../../../src/queries/safety";

describe("rollback-sensitive operations", () => {
  const transactionMock = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;

  test("stops mutual match creation if a later step fails", async () => {
    const tx: any = {
      users: {
        findUnique: jest.fn().mockResolvedValue({
          user_id: 2,
          account_status: "active",
          full_name: "Target User",
          year: 3,
          major: 1,
        }),
      },
      blocked_users: { findFirst: jest.fn().mockResolvedValue(null) },
      matches: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          match_id: 10,
          created_at: new Date(),
        }),
      },
      likes: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ like_id: 1 }),
        create: jest.fn().mockResolvedValue({
          created_at: new Date(),
        }),
      },
      passes: { findFirst: jest.fn().mockResolvedValue(null) },
      notifications: {
        createMany: jest.fn().mockRejectedValue(new Error("notification failed")),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(likeProfile(1, 2)).rejects.toThrow("notification failed");
  });

  test("stops block if a later transaction step fails", async () => {
    const tx: any = {
      users: {
        findUnique: jest.fn().mockResolvedValue({
          user_id: 1,
          account_status: "active",
        }),
      },
      blocked_users: {
        create: jest.fn().mockResolvedValue({
          blocked_id: 2,
        }),
      },
      matches: {
        findFirst: jest.fn().mockResolvedValue({ match_id: 9 }),
        update: jest.fn().mockResolvedValue({}),
      },
      messages: {
        create: jest.fn().mockRejectedValue(new Error("message failed")),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(blockUser(1, 2)).rejects.toThrow("message failed");
  });

  test("stops unmatch if a later transaction step fails", async () => {
    const tx: any = {
      matches: {
        findUnique: jest.fn().mockResolvedValue({
          match_id: 4,
          user1_id: 1,
          user2_id: 2,
          status: "active",
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      messages: {
        create: jest.fn().mockResolvedValue({}),
      },
      passes: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      notifications: {
        deleteMany: jest.fn().mockRejectedValue(new Error("cleanup failed")),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(unmatchUser(1, 4)).rejects.toThrow("cleanup failed");
  });

  test("stops deletion if a later transaction step fails", async () => {
    const tx: any = {
      users: {
        findUnique: jest.fn().mockResolvedValue({
          user_id: 1,
          account_status: "active",
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      matches: {
        findMany: jest.fn().mockResolvedValue([{ match_id: 8 }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      messages: {
        createMany: jest.fn().mockRejectedValue(new Error("system message failed")),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(deleteMyAccount(1)).rejects.toThrow("system message failed");
  });
});
