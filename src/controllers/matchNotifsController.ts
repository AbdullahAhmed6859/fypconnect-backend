import { getUpdatedProfileForMatch } from "../queries/matchNotifs";
import handleResponse from "../utils/handleResponse.js";

export async function getUpdatedProfileForMatchController(req: any, res: any) {
  const matchId = Number(req.params.matchId);
  const currentUserId = Number(req.user.user_id);
  const result = await getUpdatedProfileForMatch(currentUserId, matchId);
  return handleResponse(res, 200, "Updated profile retrieved successfully", result);
}
