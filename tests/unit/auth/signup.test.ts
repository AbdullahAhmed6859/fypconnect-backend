process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

jest.mock("../../../src/queries/emailVerification", () => ({
  buildVerificationToken: jest.fn(),
}));

import { prisma } from "../../../src/db/prisma";
import * as bcrypt from "bcrypt";
import { buildVerificationToken } from "../../../src/queries/emailVerification";
import { signup } from "../../../src/queries/signup";

describe("signup query", () => {
  const findFirstMock = prisma.users.findFirst as jest.MockedFunction<
    typeof prisma.users.findFirst
  >;

  test("rejects a non-HU email domain", async () => {
    await expect(signup("person@example.com", "secret123")).rejects.toThrow(
      "Email must be a valid Habib University email address",
    );
  });

  test("rejects a duplicate email", async () => {
    findFirstMock.mockResolvedValue({ user_id: 1 } as never);

    await expect(signup("student@st.habib.edu.pk", "secret123")).rejects.toMatchObject({
      message: "An account with this email already exists",
      statusCode: 409,
    });
  });
});
