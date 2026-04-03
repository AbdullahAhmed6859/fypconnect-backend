import { prisma } from "../config/prisma.js";
import * as bcrypt from "bcrypt";
import { buildVerificationToken } from "./emailVerification.js";

export async function signup(email: string, password: string) {
    if (!email || !password) {
        throw new Error("Email and password are required");
    }
    if (!email.endsWith("@st.habib.edu.pk")) {
        throw new Error("Email must be a valid Habib University email address");
    }
    const existingUser = await prisma.users.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new Error("Email is already in use");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rawToken, hashedToken, expiresAt } = buildVerificationToken();

    const newUser = await prisma.users.create({
        data: {
            email,
            password_hash: hashedPassword,
            verified: false,
            verification_token: hashedToken,
            verification_expires_at: expiresAt,
            verification_sent_at: new Date(),
            verification_resend_count: 0,
        },
    });

    return { newUser, rawToken };
}
