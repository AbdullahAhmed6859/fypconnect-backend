import {getActiveMatchesForUser} from '../queries/match'
import handleResponse from "../utils/handleResponse.js";

export async function getActiveMatchesController(req: any, res: any) {
    const currentUserId = Number(req.user.user_id);
    try {
        const result = await getActiveMatchesForUser(currentUserId);
        return handleResponse(res, 200, "Updated profile retrieved successfully", result);
    } catch (error: any) {
        return handleResponse(res, error.statusCode ?? 400, error.message);
    }
}
