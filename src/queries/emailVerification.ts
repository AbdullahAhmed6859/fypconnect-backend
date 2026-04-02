import { prisma } from "../config/prisma.js";
import * as bcrypt from "bcrypt";
import crypto from "crypto"
import { sendVerificationEmail } from "../utils/sendVerificationEmail.js";


export function buildVerificationToken() {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
    return { verificationToken, expiresAt }
}

export async function verifyEmailToken(user_id: string) {
    try {     
        const user = await prisma.users.findFirst({
                    where: {user_id: user_id,
                    },
                });
        if (!user) {
                throw new Error("Invalid verification token");
            }

        if (user.verified) {
            return {alreadyVerified: true}
            }
        if (
            !user.verification_expires_at ||
            user.verification_expires_at < new Date()
        ) {
            throw new Error("Verification token has expired");
        }
        

        await prisma.users.update({
             where: { user_id: user.user_id },
            data: {
                verified: true,
                verification_token: null,
                verification_expires_at: null,
                account_status: "active"
            },
        });

        return {alreadyVerified: false};
    } catch (error) {
        throw new Error("Error occurred while verifying email");
    }
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

    if (
        user.verification_sent_at &&
        Date.now() - new Date(user.verification_sent_at).getTime() < 60 * 1000
    ) {
        throw new Error("Please wait before requesting another verification email");
    }

    if (user.verification_resend_count >= 5) {
        throw new Error("Maximum resend attempts reached");
    }

    const { verificationToken, expiresAt } = buildVerificationToken();

    await prisma.users.update({
        where: { user_id: user.user_id },
        data: {
            verification_token: verificationToken,
            verification_expires_at: expiresAt,
            verification_sent_at: new Date(),
            verification_resend_count: {
                increment: 1,
            },
        },
    });

    await sendVerificationEmail(user.email, verificationToken);
}