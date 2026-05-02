process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    skills: { count: jest.fn() },
    interests: { count: jest.fn() },
    years: { count: jest.fn() },
    majors: { count: jest.fn() },
  },
}));

import { prisma } from "../../../src/db/prisma";
import { updateMyProfile } from "../../../src/queries/profileUpdate";

function buildProfile(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 1,
    account_status: "active",
    full_name: "Ali",
    year: 3,
    major: 2,
    biography: "Old bio",
    ideas: "Old idea",
    profile_pic: "old.png",
    created_at: new Date("2026-04-01T00:00:00.000Z"),
    profile_updated_at: new Date("2026-04-10T00:00:00.000Z"),
    years: { year_id: 3, year: 3 },
    majors: { major_id: 2, majors: "CS" },
    user_skills: [{ skill_id: 1, skills: { skill: "JS" } }],
    user_interests: [{ interest_id: 1, interests: { interest: "AI" } }],
    major_preferences: [],
    skills_preferences: [],
    interests_preferences: [],
    user_projects: [],
    user_links: [],
    ...overrides,
  };
}

describe("profile updated notifications", () => {
  const transactionMock = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;

  test("sends PROFILE UPDATED notifications for key fields", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(buildProfile({ biography: "New bio" })),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn().mockResolvedValue([
          { match_id: 9, user1_id: 1, user2_id: 2 },
        ]),
      },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, { bio: "New bio" });

    expect(result.profileUpdatedNotificationsSent).toBe(true);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          match_id: 9,
          type: "PROFILE_UPDATED",
        },
      ],
    });
  });

  test("does not send PROFILE UPDATED notifications for only full name and profile picture", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(
            buildProfile({
              full_name: "Ali Raza",
              profile_pic: "new.png",
            }),
          ),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn(),
      },
      notifications: {
        createMany: jest.fn(),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, {
      fullName: "Ali Raza",
      profilePicture: "new.png",
    });

    expect(result.profileUpdatedNotificationsSent).toBe(false);
    expect(tx.notifications.createMany).not.toHaveBeenCalled();
  });

  test("sends PROFILE UPDATED notifications for skills changes", async () => {
    const skillsCountMock = prisma.skills.count as jest.MockedFunction<
      typeof prisma.skills.count
    >;
    skillsCountMock.mockResolvedValue(1);

    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(buildProfile({ user_skills: [{ skill_id: 2, skills: { skill: "Python" } }] })),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn().mockResolvedValue([
          { match_id: 9, user1_id: 1, user2_id: 2 },
        ]),
      },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, { skills: [2] });

    expect(result.profileUpdatedNotificationsSent).toBe(true);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          match_id: 9,
          type: "PROFILE_UPDATED",
        },
      ],
    });
  });

  test("sends PROFILE UPDATED notifications for interests changes", async () => {
    const interestsCountMock = prisma.interests.count as jest.MockedFunction<
      typeof prisma.interests.count
    >;
    interestsCountMock.mockResolvedValue(1);

    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(buildProfile({ user_interests: [{ interest_id: 2, interests: { interest: "ML" } }] })),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn().mockResolvedValue([
          { match_id: 9, user1_id: 1, user2_id: 2 },
        ]),
      },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, { interests: [2] });

    expect(result.profileUpdatedNotificationsSent).toBe(true);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          match_id: 9,
          type: "PROFILE_UPDATED",
        },
      ],
    });
  });

  test("sends PROFILE UPDATED notifications for projects changes", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(buildProfile({ user_projects: [{ project_name: "New Project", project_link: null }] })),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn().mockResolvedValue([
          { match_id: 9, user1_id: 1, user2_id: 2 },
        ]),
      },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, { projects: [{ project_name: "New Project" }] });

    expect(result.profileUpdatedNotificationsSent).toBe(true);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          match_id: 9,
          type: "PROFILE_UPDATED",
        },
      ],
    });
  });

  test("sends PROFILE UPDATED notifications for fypIdea changes", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(buildProfile({ ideas: "New idea" })),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn().mockResolvedValue([
          { match_id: 9, user1_id: 1, user2_id: 2 },
        ]),
      },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, { fypIdea: "New idea" });

    expect(result.profileUpdatedNotificationsSent).toBe(true);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          match_id: 9,
          type: "PROFILE_UPDATED",
        },
      ],
    });
  });

  test("sends PROFILE UPDATED notifications for external link changes", async () => {
    const tx: any = {
      users: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildProfile())
          .mockResolvedValueOnce(buildProfile({ user_links: [{ name_: "github", link: "https://new.link" }] })),
        update: jest.fn().mockResolvedValue({}),
      },
      user_skills: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_interests: { deleteMany: jest.fn(), createMany: jest.fn() },
      major_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      skills_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      interests_preferences: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_projects: { deleteMany: jest.fn(), createMany: jest.fn() },
      user_links: { deleteMany: jest.fn(), createMany: jest.fn() },
      matches: {
        findMany: jest.fn().mockResolvedValue([
          { match_id: 9, user1_id: 1, user2_id: 2 },
        ]),
      },
      notifications: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => callback(tx));

    const result = await updateMyProfile(1, {
      links: { github: "https://new.link" },
    });

    expect(result.profileUpdatedNotificationsSent).toBe(true);
    expect(tx.notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          match_id: 9,
          type: "PROFILE_UPDATED",
        },
      ],
    });
  });
});
