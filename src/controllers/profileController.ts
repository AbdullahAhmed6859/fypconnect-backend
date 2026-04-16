import { ProfileSetupInput, profileSetup, getProfile, getPreferences} from "../queries/profile.js";
import { updateMyProfile } from "../queries/profileUpdate.js";
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

export const getUserProfile = async (req: any, res: any) => {
    const userId = req.user.user_id;

    try {
        const profile = await getProfile(userId);
        return handleResponse(res, 200, "Profile retrieved successfully", profile);
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
}

export const getUserPreferences = async (req: any, res: any) => {
    const userId = req.user.user_id;

    try {
        const preferences = await getPreferences(userId);
        return handleResponse(res, 200, "Preferences retrieved successfully", preferences);
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
}

export async function updateMyProfileController(req: any, res: any) {
    try {
        const result = await updateMyProfile(Number(req.user.user_id), req.body);
        return handleResponse(res, 200, "Profile updated successfully", result);
    } catch (error: any) {
        return handleResponse(res, error.statusCode ?? 400, error.message);
    }
}
