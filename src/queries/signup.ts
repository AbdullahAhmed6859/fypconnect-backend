import { prisma } from "../db/prisma";
import * as bcrypt from "bcrypt";
import { Prisma } from "../generated/prisma/client";
import { buildVerificationToken } from "./emailVerification";

export async function signup(email: string, password: string) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // console.log("email password are present", email);
  if (!normalizedEmail.endsWith("@st.habib.edu.pk")) {
    throw new Error("Email must be a valid Habib University email address");
  }

  const existingUser = await prisma.users.findFirst({
    where: {
      email: normalizedEmail,
      account_status: { not: "deleted" },
    }, 

  });


  if (existingUser) {
    const err = new Error("An account with this email already exists");
    (err as any).statusCode = 409;
    throw err;
  }

  console.log("email is valid and not in use, proceeding to hash password");
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
      const err = new Error("An account with this email already exists");
      (err as any).statusCode = 409;
      throw err;
    }

    throw error;
  }

  return { newUser, rawToken };
}
