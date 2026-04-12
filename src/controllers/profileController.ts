import { ProfileSetupInput, profileSetup } from "../queries/profile.js";
import handleResponse from "../utils/handleResponse.js";

export const setupProfile = async (req: any, res: any) => {
    const ProfileSetupInput: ProfileSetupInput = req.body;
    ProfileSetupInput.userId = req.user.user_id;
    
    try {
        const profile = await profileSetup(ProfileSetupInput);
        return handleResponse(res, 200, "Profile setup successful", profile);
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
}