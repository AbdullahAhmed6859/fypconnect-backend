process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma.js", () => ({
  prisma: {
    $transaction: jest.fn(),
    years: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "../../../src/db/prisma.js";
import { profileSetup } from "../../../src/queries/profile";

describe("profile setup", () => {
  const transactionMock = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;
  const yearFindUniqueMock = prisma.years.findUnique as jest.MockedFunction<
    typeof prisma.years.findUnique
  >;

  test("marks a junior or senior as eligible for browsing", async () => {
    const tx: any = {
      users: {
        findUnique: jest.fn().mockResolvedValue({
          user_id: 1,
          full_name: null,
          year: null,
          major: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { createMany: jest.fn().mockResolvedValue({}) },
      user_interests: { createMany: jest.fn().mockResolvedValue({}) },
      user_projects: { createMany: jest.fn().mockResolvedValue({}) },
      user_links: { createMany: jest.fn().mockResolvedValue({}) },
      major_preferences: { createMany: jest.fn().mockResolvedValue({}) },
      skills_preferences: { createMany: jest.fn().mockResolvedValue({}) },
      interests_preferences: { createMany: jest.fn().mockResolvedValue({}) },
    };

    yearFindUniqueMock.mockResolvedValue({ year: 3 } as never);
    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await profileSetup({
      userId: 1,
      fullName: "Ali",
      yearId: 3,
      majorId: 2,
      skills: [1],
      interests: [1],
    });

    expect(result.data.eligibleForBrowsing).toBe(true);
  });

  test("marks a freshman or sophomore as not eligible for browsing", async () => {
    const tx: any = {
      users: {
        findUnique: jest.fn().mockResolvedValue({
          user_id: 1,
          full_name: null,
          year: null,
          major: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { createMany: jest.fn().mockResolvedValue({}) },
      user_interests: { createMany: jest.fn().mockResolvedValue({}) },
      user_projects: { createMany: jest.fn().mockResolvedValue({}) },
      user_links: { createMany: jest.fn().mockResolvedValue({}) },
      major_preferences: { createMany: jest.fn().mockResolvedValue({}) },
      skills_preferences: { createMany: jest.fn().mockResolvedValue({}) },
      interests_preferences: { createMany: jest.fn().mockResolvedValue({}) },
    };

    yearFindUniqueMock.mockResolvedValue({ year: 2 } as never);
    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await profileSetup({
      userId: 1,
      fullName: "Ali",
      yearId: 2,
      majorId: 2,
      skills: [1],
      interests: [1],
    });

    expect(result.data.eligibleForBrowsing).toBe(false);
  });

  test("does not finish setup if one of the required save steps fails", async () => {
    const tx: any = {
      users: {
        findUnique: jest.fn().mockResolvedValue({
          user_id: 1,
          full_name: null,
          year: null,
          major: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: {
        createMany: jest.fn().mockRejectedValue(new Error("skills save failed")),
      },
      user_interests: { createMany: jest.fn().mockResolvedValue({}) },
      user_projects: { createMany: jest.fn().mockResolvedValue({}) },
      user_links: { createMany: jest.fn().mockResolvedValue({}) },
      major_preferences: { createMany: jest.fn().mockResolvedValue({}) },
      skills_preferences: { createMany: jest.fn().mockResolvedValue({}) },
      interests_preferences: { createMany: jest.fn().mockResolvedValue({}) },
    };

    yearFindUniqueMock.mockResolvedValue({ year: 3 } as never);
    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    await expect(
      profileSetup({
        userId: 1,
        fullName: "Ali",
        yearId: 3,
        majorId: 2,
        skills: [1],
        interests: [1],
      }),
    ).rejects.toThrow("skills save failed");

    expect(tx.user_interests.createMany).not.toHaveBeenCalled();
  });
});
