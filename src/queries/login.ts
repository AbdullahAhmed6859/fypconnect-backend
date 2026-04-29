// src/queries/login.ts
import { prisma } from "../db/prisma.js";
import * as bcrypt from "bcrypt";

export async function login(email: string, password: unknown) {
  if (!email || !password || typeof password !== "string") {
    throw new Error("Email and password are required");
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
  throw new Error("Invalid email or password");
}
const isMatch = await bcrypt.compare(password, user.password_hash);
if (!isMatch) {
  await prisma.auth_logs.create({
    data: { user_id: user.user_id, email_attempted: normalizedEmail, success: false },
  });
  throw new Error("Invalid email or password");
}
if (!user.verified) {
  const err = new Error("Please verify your email before logging in");
  (err as any).statusCode = 403;
  throw err;
}

await prisma.auth_logs.create({
  data: { user_id: user.user_id, email_attempted: normalizedEmail, success: true },
});
  return user;
}
