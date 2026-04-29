import crypto from "crypto";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma", () => ({
  prisma: {
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../../src/utils/sendVerificationEmail", () => ({
  sendVerificationEmail: jest.fn(),
}));

import { prisma } from "../../../src/db/prisma";
import {
  resendVerificationEmailForUser,
  verifyEmailToken,
} from "../../../src/queries/emailVerification";
import { sendVerificationEmail } from "../../../src/utils/sendVerificationEmail";

describe("email verification queries", () => {
  const mockedSendVerificationEmail = sendVerificationEmail as jest.MockedFunction<
    typeof sendVerificationEmail
  >;
  const findUniqueMock = prisma.users.findUnique as jest.MockedFunction<
    typeof prisma.users.findUnique
  >;
  const updateMock = prisma.users.update as jest.MockedFunction<typeof prisma.users.update>;

  test("rejects an expired verification code", async () => {
    const rawToken = "123456";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    findUniqueMock.mockResolvedValue({
      user_id: 44,
      email: "student@st.habib.edu.pk",
      verified: false,
      verification_token: hashedToken,
      verification_expires_at: new Date(Date.now() - 60_000),
    } as never);

    await expect(verifyEmailToken("student@st.habib.edu.pk", rawToken)).rejects.toThrow(
      "Verification token has expired",
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("enforces the resend-verification rate limit", async () => {
    findUniqueMock.mockResolvedValue({
      user_id: 55,
      email: "student@st.habib.edu.pk",
      verified: false,
      verification_resend_count: 3,
      verification_sent_at: new Date(Date.now() - 10 * 60 * 1000),
    } as never);

    await expect(
      resendVerificationEmailForUser("student@st.habib.edu.pk"),
    ).rejects.toMatchObject({
      message: "Verification email resend limit exceeded. Try again later.",
      statusCode: 429,
    });
  });
});
