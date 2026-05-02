import { prisma } from "../db/prisma";
import * as bcrypt from "bcrypt";
import { Prisma } from "../generated/prisma/client";
import { buildVerificationToken } from "./emailVerification";
import AppError from "../utils/appError";

export async function signup(email: string, password: string) {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.endsWith("@st.habib.edu.pk")) {
    throw new AppError("Email must be a valid Habib University email address", 400);
  }

  const existingUser = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    },
  });

  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const { rawToken, hashedToken, expiresAt } = buildVerificationToken();

  let newUser;

  try {
    newUser = await prisma.users.create({
      data: {
        email: normalizedEmail,
        password_hash: hashedPassword,
        verified: false,
        verification_token: hashedToken,
        verification_expires_at: expiresAt,
        verification_sent_at: new Date(),
        verification_resend_count: 0,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("An account with this email already exists", 409);
    }

    throw error;
  }

  return { newUser, rawToken };
}
