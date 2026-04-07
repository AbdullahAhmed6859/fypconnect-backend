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
  const user = await prisma.users.findUnique({
    where: { email },
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
    throw new Error("Invalid verification code");
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

  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
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
