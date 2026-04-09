import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

export async function sendVerificationEmail(email: string, token: string){
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your email",
        html: `
            <h2>Verify your email</h2>
            <p>Your verification code is:</p>
            <h1>${token}</h1>
            <p>This code will expire in 24 hours.</p>
        `,
    });
}