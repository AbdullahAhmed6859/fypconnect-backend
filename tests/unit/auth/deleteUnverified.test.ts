process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

const scheduleMock = jest.fn();

jest.mock("node-cron", () => ({
  __esModule: true,
  default: {
    schedule: scheduleMock,
  },
}));

jest.mock("../../../src/db/prisma", () => ({
  prisma: {
    users: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import scheduleUnverifiedUserDeletion from "../../../src/cronJob/deleteUnverified";
import { prisma } from "../../../src/db/prisma";

describe("delete unverified users", () => {
  const findManyMock = prisma.users.findMany as jest.MockedFunction<typeof prisma.users.findMany>;
  const deleteMock = prisma.users.delete as jest.MockedFunction<typeof prisma.users.delete>;

  test("auto-deletes an unverified account after 7 days", async () => {
    findManyMock.mockResolvedValue([
      {
        user_id: 1,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: 2,
        created_at: new Date(),
      },
    ] as never);
    deleteMock.mockResolvedValue({ user_id: 1 } as never);

    scheduleUnverifiedUserDeletion();

    const scheduledJob = scheduleMock.mock.calls[0][1] as () => void;
    scheduledJob();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith({
      where: {
        user_id: 1,
      },
    });
  });
});
