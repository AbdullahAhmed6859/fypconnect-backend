import handleResponse from "../utils/handleResponse.js";
import { resendVerificationEmailForUser } from "../queries/emailVerification.js";

export async function resendVerificationController(req: any, res: any) {
    const { email } = req.body;

    try {
        await resendVerificationEmailForUser(email);
        return handleResponse(res, 200, "Verification email resent successfully");
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
}