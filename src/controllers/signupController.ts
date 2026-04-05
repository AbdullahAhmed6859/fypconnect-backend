import { signup } from "../queries/signup.js";
import handleResponse from "../utils/handleResponse.js";
import { sendVerificationEmail } from "../utils/sendVerificationEmail.js";

export async function signupController(req: any, res: any) {
    const { email, password } = req.body;
    try {
        const {newUser, rawToken} = await signup(email, password);
        try {
            await sendVerificationEmail(newUser.email, rawToken);
        } catch (error) {
            return handleResponse(
                res,
                201,
                "User created, but verification email could not be sent. Please request a resend.",
                {
                    user_id: newUser.user_id,
                    email: newUser.email,
                    verified: newUser.verified,
                    account_status: newUser.account_status,
                }
            );
        }

        return handleResponse(
            res,
            201,
            "User created successfully. Please check your email for your verification token",
            {
                user_id: newUser.user_id,
                email: newUser.email,
                verified: newUser.verified,
                account_status: newUser.account_status,
            }
        );
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
};


