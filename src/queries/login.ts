import { prisma } from "../db/prisma.js";
import * as bcrypt from "bcrypt";
import AppError from "../utils/appError.js";

export async function login(email: string, password: unknown) {
  if (!email || !password || typeof password !== "string") {
    throw new AppError("Email and password are required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    },
  });

  if (!user) {
    await prisma.auth_logs.create({
      data: { user_id: null, email_attempted: normalizedEmail, success: false },
    });
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    await prisma.auth_logs.create({
      data: { user_id: user.user_id, email_attempted: normalizedEmail, success: false },
    });
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.verified) {
    throw new AppError("Please verify your email before logging in", 403);
  }

  await prisma.auth_logs.create({
    data: { user_id: user.user_id, email_attempted: normalizedEmail, success: true },
  });

  return user;
}
