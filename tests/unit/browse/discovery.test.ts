process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma.js", () => ({
  prisma: {
    skills: {
      count: jest.fn(),
    },
    interests: {
      count: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../../src/db/prisma.js";
import { getDiscoveryProfiles } from "../../../src/queries/discovery";

describe("browse feed rules", () => {
  const findUniqueMock = prisma.users.findUnique as jest.MockedFunction<typeof prisma.users.findUnique>;
  const findManyMock = prisma.users.findMany as jest.MockedFunction<typeof prisma.users.findMany>;

  test("applies self, liked, passed, and blocked exclusions", async () => {
    findUniqueMock.mockResolvedValue({
      year: 3,
      user_skills: [{ skill_id: 1 }],
      user_interests: [],
      skills_preferences: [{ preferred_skill_id: 1 }],
      interests_preferences: [],
    } as never);
    findManyMock.mockResolvedValue([] as never);

    await getDiscoveryProfiles({
      currentUserId: 7,
      limit: 20,
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: { not: 7 },
          likes_likes_liked_idTousers: {
            none: {
              liker_id: 7,
            },
          },
          passes_passes_passed_idTousers: {
            none: {
              passer_id: 7,
            },
          },
          blocked_users_blocked_users_blocked_idTousers: {
            none: {
              blocker_id: 7,
            },
          },
          blocked_users_blocked_users_blocker_idTousers: {
            none: {
              blocked_id: 7,
            },
          },
        }),
      }),
    );
  });
});
