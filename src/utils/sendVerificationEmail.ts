import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

export async function sendVerificationEmail(email: string, token: string){
    const verificationUrl = `http://localhost:3000/signup/verify?token=${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your email",
        html: `
            <h2>Verify your email</h2>
            <p>Click the link below to verify your account:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
        `,
    });
}