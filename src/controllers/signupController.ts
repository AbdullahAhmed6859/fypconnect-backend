import { send } from "node:process";
import { signup } from "../queries/signup.js";
import handleResponse from "../utils/handleResponse.js";
import { sendVerificationEmail } from "../utils/sendVerificationEmail.js";

export async function signupController(req: any, res: any) {
    const { email, password } = req.body;
    try {
        const {newUser, verificationToken} = await signup(email, password);
        await sendVerificationEmail(newUser.email, verificationToken)
        return handleResponse(res, 
                            201, 
                            "User created successfully. Please check your email to verify your email ID", 
                            newUser);
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
};


