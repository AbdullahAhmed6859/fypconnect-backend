import handleResponse from "../utils/handleResponse";
import { getMyProfile, updateMyProfile } from "../queries/profile.js";

export async function getMyProfileController(req: any, res: any) {
  try {
    const profile = await getMyProfile(Number(req.user.user_id));
    return handleResponse(res, 200, "Profile retrieved successfully", profile);
  } catch (error: any) {
    return handleResponse(res, error.statusCode ?? 500, error.message);
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
