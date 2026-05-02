import {
  likeProfile,
  normalizeLikeProfileInput,
  normalizePassProfileInput,
  passProfile,
} from "../queries/browse.js";
import handleResponse from "../utils/handleResponse.js";

export async function likeProfileController(req: any, res: any) {
  const input = normalizeLikeProfileInput(Number(req.user.user_id), req.body);
  const result = await likeProfile(input.currentUserId, input.targetUserId);

  return handleResponse(res, 200, "Profile liked successfully", result);
}

export async function passProfileController(req: any, res: any) {
  const input = normalizePassProfileInput(Number(req.user.user_id), req.body);
  const result = await passProfile(input.currentUserId, input.targetUserId);

  return handleResponse(res, 200, "Profile passed successfully", result);
}
