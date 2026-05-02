import {
  blockUser,
  deleteMyAccount,
  getBlockedUsers,
  normalizeMatchInput,
  normalizeTargetUserInput,
  unblockUser,
  unmatchUser,
} from "../queries/safety.js";
import handleResponse from "../utils/handleResponse.js";

export async function deleteMyAccountController(req: any, res: any) {
  const result = await deleteMyAccount(Number(req.user.user_id));

  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return handleResponse(res, 200, "Account deleted successfully", result);
}

export async function getBlockedUsersController(req: any, res: any) {
  const result = await getBlockedUsers(Number(req.user.user_id));
  return handleResponse(res, 200, "Restricted users retrieved successfully", result);
}

export async function blockUserController(req: any, res: any) {
  const input = normalizeTargetUserInput(req.body ?? {});
  const result = await blockUser(Number(req.user.user_id), input.targetUserId);

  return handleResponse(res, 200, "User restricted successfully", result);
}

export async function unblockUserController(req: any, res: any) {
  const input = normalizeTargetUserInput(req.body ?? {});
  const result = await unblockUser(Number(req.user.user_id), input.targetUserId);

  return handleResponse(res, 200, "User unrestricted successfully", result);
}

export async function unmatchUserController(req: any, res: any) {
  const input = normalizeMatchInput(req.params.matchId);
  const result = await unmatchUser(Number(req.user.user_id), input.matchId);

  return handleResponse(res, 200, "Match ended successfully", result);
}
