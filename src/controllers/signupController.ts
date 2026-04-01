import { signup } from "../queries/signup.js";
import handleResponse from "../utils/handleResponse.js";

export async function signupController(req: any, res: any) {
    const { email, password } = req.body;
    try {
        const newUser = await signup(email, password);
        return handleResponse(res, 201, "User created successfully", newUser);
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
};


