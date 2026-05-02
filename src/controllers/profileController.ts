import {
    ProfileSetupInput,
    profileSetup,
    getProfile,
    getPreferences,
    normalizePreferencesInput,
    savePreferences,
    getSkillsAndInterests,
    dismissAnnualYearReview
} from "../queries/profile.js";
import { updateMyProfile } from "../queries/profileUpdate.js";
import handleResponse from "../utils/handleResponse.js";

export const getSkillsAndInterestsController = async (req: any, res: any) => {
    const data = await getSkillsAndInterests();
    return handleResponse(res, 200, "Skills and interests retrieved successfully", data);
}

export const setupProfile = async (req: any, res: any) => {
    const input: ProfileSetupInput = req.body;
    input.userId = req.user.user_id;

    const profile = await profileSetup(input);
    return handleResponse(res, 200, "Profile setup successful", profile);
}

export const getUserProfile = async (req: any, res: any) => {
    const userId = req.user.user_id;
    const profile = await getProfile(userId);
    return handleResponse(res, 200, "Profile retrieved successfully", profile);
}

export const getUserPreferences = async (req: any, res: any) => {
    const userId = req.user.user_id;
    const preferences = await getPreferences(userId);
    return handleResponse(res, 200, "Preferences retrieved successfully", preferences);
}

export const updateUserPreferences = async (req: any, res: any) => {
    const preferencesInput = normalizePreferencesInput({
        ...req.body,
        userId: req.user.user_id,
    });

    const preferences = await savePreferences(preferencesInput);
    return handleResponse(res, 200, "Preferences updated successfully", preferences);
}

export async function dismissAnnualYearReviewController(req: any, res: any) {
    const result = await dismissAnnualYearReview(Number(req.user.user_id));
    return handleResponse(res, 200, "Annual year review dismissed", result);
}

export async function updateMyProfileController(req: any, res: any) {
    const result = await updateMyProfile(Number(req.user.user_id), req.body);
    return handleResponse(res, 200, "Profile updated successfully", result);
}
