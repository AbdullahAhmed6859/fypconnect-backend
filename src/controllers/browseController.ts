import {
  likeProfile,
  normalizeLikeProfileInput,
  normalizePassProfileInput,
  passProfile,
} from "../queries/browse.js";
import handleResponse from "../utils/handleResponse.js";

export async function likeProfileController(req: any, res: any) {
  try {
    const input = normalizeLikeProfileInput(Number(req.user.user_id), req.body);
    const result = await likeProfile(input.currentUserId, input.targetUserId);

    return handleResponse(res, 200, "Profile liked successfully", result);
  } catch (error: any) {
    return handleResponse(res, error.statusCode ?? 400, error.message);
  }
}

export async function passProfileController(req: any, res: any) {
  try {
    const input = normalizePassProfileInput(Number(req.user.user_id), req.body);
    const result = await passProfile(input.currentUserId, input.targetUserId);

    return handleResponse(res, 200, "Profile passed successfully", result);
  } catch (error: any) {
    return handleResponse(res, error.statusCode ?? 400, error.message);
  }
}
