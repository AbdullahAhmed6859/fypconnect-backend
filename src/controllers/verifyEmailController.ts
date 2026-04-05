import { verifyEmailToken } from "../queries/emailVerification.js";
import handleResponse from "../utils/handleResponse.js";

export async function verifyEmailController(req: any, res: any){
    const { email, token } = req.body;
    try{
        const result = await verifyEmailToken(email, token);

        if (result.alreadyVerified) {
            return handleResponse(res, 200, "Email is already verified");
        }

        return handleResponse(res, 200, "Email verified successfully");
        

    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
}