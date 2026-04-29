import { prisma } from "../db/prisma";
import crypto from "crypto";
import { sendVerificationEmail } from "../utils/sendVerificationEmail";

export function buildVerificationToken() {
  const rawToken = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  return { rawToken, hashedToken, expiresAt };
}

export async function verifyEmailToken(email: string, token: string) {
  if (!email || !token) {
    throw new Error("Email and verification token are required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.verified) {
    return { alreadyVerified: true };
  }
  if (
    !user.verification_expires_at ||
    user.verification_expires_at < new Date()
  ) {
    throw new Error("Verification token has expired");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  if (user.verification_token !== hashedToken) {
    const err = new Error("Invalid verification code");
    (err as any).statusCode = 400;
    throw err;
  }
  await prisma.users.update({
    where: { user_id: user.user_id },
    data: {
      verified: true,
      verification_token: null,
      verification_expires_at: null,
      account_status: "active",
    },
  });

  return { alreadyVerified: false };
}

export async function resendVerificationEmailForUser(email: string) {
  if (!email) {
    throw new Error("Email is required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    },
  });

  if (!user) {
    const err = new Error("User not found");
    (err as any).statusCode = 404;
    throw err;
  }

  if (user.verified) {
    throw new Error("Email is already verified");
  }

  const now = new Date();
  const oneHourMs = 60 * 60 * 1000;
  let resendCount = user.verification_resend_count;
  const sentAt = user.verification_sent_at;

  if (!sentAt || now.getTime() - sentAt.getTime() >= oneHourMs) {
    resendCount = 0;
  }

  if (resendCount >= 3) {
  const err = new Error("Verification email resend limit exceeded. Try again later.");
  (err as any).statusCode = 429;
  throw err;
}

  const { rawToken, hashedToken, expiresAt } = buildVerificationToken();

  await prisma.users.update({
    where: { user_id: user.user_id },
    data: {
      verification_token: hashedToken,
      verification_expires_at: expiresAt,
      verification_sent_at: new Date(),
      verification_resend_count: resendCount + 1,
    },
  });

  await sendVerificationEmail(user.email, rawToken);
}
