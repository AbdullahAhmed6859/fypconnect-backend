import crypto from "crypto";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/fypconnect_test";

jest.mock("../../../src/db/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../../src/utils/sendVerificationEmail", () => ({
  sendVerificationEmail: jest.fn(),
}));

import { prisma } from "../../../src/db/prisma";
import {
  buildVerificationToken,
  resendVerificationEmailForUser,
  verifyEmailToken,
} from "../../../src/queries/emailVerification";
import { sendVerificationEmail } from "../../../src/utils/sendVerificationEmail";

describe("email verification queries", () => {
  const mockedSendVerificationEmail = sendVerificationEmail as jest.MockedFunction<
    typeof sendVerificationEmail
  >;
  const findFirstMock = prisma.users.findFirst as jest.MockedFunction<
    typeof prisma.users.findFirst
  >;
  const updateMock = prisma.users.update as jest.MockedFunction<typeof prisma.users.update>;

  test("rejects an expired verification code", async () => {
    const rawToken = "123456";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    findFirstMock.mockResolvedValue({
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

  test("accepts a valid verification code exactly at the 24-hour expiry boundary", async () => {
    const rawToken = "999999";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    findFirstMock.mockResolvedValue({
      user_id: 66,
      email: "student@st.habib.edu.pk",
      verified: false,
      verification_token: hashedToken,
      verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as never);
    updateMock.mockResolvedValue({} as never);

    const result = await verifyEmailToken("student@st.habib.edu.pk", rawToken);

    expect(result).toEqual({ alreadyVerified: false });
    expect(updateMock).toHaveBeenCalledWith({
      where: { user_id: 66 },
      data: {
        verified: true,
        verification_token: null,
        verification_expires_at: null,
        account_status: "active",
      },
    });
  });

  test("rejects a verification code immediately after the 24-hour expiry boundary", async () => {
    const rawToken = "111111";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    findFirstMock.mockResolvedValue({
      user_id: 77,
      email: "student@st.habib.edu.pk",
      verified: false,
      verification_token: hashedToken,
      verification_expires_at: new Date(Date.now() - 1),
    } as never);

    await expect(verifyEmailToken("student@st.habib.edu.pk", rawToken)).rejects.toThrow(
      "Verification token has expired",
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("generates a verification token valid for 24 hours", () => {
    const before = Date.now();
    const { rawToken, hashedToken, expiresAt } = buildVerificationToken();

    expect(rawToken).toMatch(/^\d{6}$/);
    expect(hashedToken).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(before + 24 * 60 * 60 * 1000 + 1000);
  });

  test("enforces the resend-verification rate limit", async () => {
    findFirstMock.mockResolvedValue({
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
