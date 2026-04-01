import { prisma } from "../config/prisma.js";
import * as bcrypt from "bcrypt";

export async function signup(email: string, password: string) {
    try {     
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

        const newUser = await prisma.users.create({
            data: {
                email,
                password_hash: hashedPassword,
                verified: false
            },
        });

        return newUser;
    } catch (error) {
        throw new Error("Error occurred while signing up");
    }
}