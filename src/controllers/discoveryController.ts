import {
  getDiscoveryProfiles,
  normalizeDiscoveryFilters,
} from "../queries/discovery.js";
import handleResponse from "../utils/handleResponse.js";

export async function getDiscoveryProfilesController(req: any, res: any) {
  const filters = normalizeDiscoveryFilters(
    Number(req.user.user_id),
    req.query as Record<string, unknown>
  );

  const profiles = await getDiscoveryProfiles(filters);
  return handleResponse(
    res,
    200,
    "Discovery profiles retrieved successfully",
    profiles
  );
}
