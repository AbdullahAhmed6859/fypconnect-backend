// src/queries/login.ts
import { prisma } from "../db/prisma.js";
import * as bcrypt from "bcrypt";

export async function login(email: string, password: unknown) {
  if (!email || !password || typeof password !== "string") {
    throw new Error("Email and password are required");
  }

  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    // Generic error to prevent email enumeration
    throw new Error("Invalid email or password");
  }

  if (!user.verified) {
    throw new Error("Please verify your email before logging in");
  }

  // Compare the plain text password with the stored hash
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  return user;
}
