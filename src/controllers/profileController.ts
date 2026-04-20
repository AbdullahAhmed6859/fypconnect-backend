import {
    ProfileSetupInput,
    profileSetup,
    getProfile,
    getPreferences,
    normalizePreferencesInput,
    savePreferences,
    getSkillsAndInterests
} from "../queries/profile.js";
import { updateMyProfile } from "../queries/profileUpdate.js";
import handleResponse from "../utils/handleResponse.js";

export const getSkillsAndInterestsController = async (req: any, res: any) => {
    const userId = req.user.user_id;
    if (!userId) {
        return handleResponse(res, 401, "Unauthorized");
    }
    try {
        const data = await getSkillsAndInterests();
        return handleResponse(res, 200, "Skills and interests retrieved successfully", data);
    } catch (error: any) {
        return handleResponse(res, 400, error.message);
    }
}

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

export const updateUserPreferences = async (req: any, res: any) => {
    try {
        const preferencesInput = normalizePreferencesInput({
            ...req.body,
            userId: req.user.user_id,
        });

        const preferences = await savePreferences(preferencesInput);
        return handleResponse(res, 200, "Preferences updated successfully", preferences);
    } catch (error: any) {
        return handleResponse(res, error.statusCode ?? 400, error.message);
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
