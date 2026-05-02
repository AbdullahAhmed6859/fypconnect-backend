import { prisma } from "../db/prisma";
import crypto from "crypto";
import { sendVerificationEmail } from "../utils/sendVerificationEmail";
import AppError from "../utils/appError";

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
    throw new AppError("Email and verification token are required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.verified) {
    return { alreadyVerified: true };
  }

  if (
    !user.verification_expires_at ||
    user.verification_expires_at < new Date()
  ) {
    throw new AppError("Verification token has expired", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  if (user.verification_token !== hashedToken) {
    throw new AppError("Invalid verification code", 400);
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
    throw new AppError("Email is required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.verified) {
    throw new AppError("Email is already verified", 400);
  }

  const now = new Date();
  const oneHourMs = 60 * 60 * 1000;
  let resendCount = user.verification_resend_count;
  const sentAt = user.verification_sent_at;

  if (!sentAt || now.getTime() - sentAt.getTime() >= oneHourMs) {
    resendCount = 0;
  }

  if (resendCount >= 3) {
    throw new AppError(
      "Verification email resend limit exceeded. Try again later.",
      429,
    );
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
