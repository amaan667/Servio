/**
 * Access context API - Bearer-token fallback for mobile
 *
 * Use when cookies fail (e.g. iOS Safari) but client has session in localStorage.
 * Client sends Bearer token; we return role/tier from get_access_context RPC.
 * Single source of truth: database via RPC.
 */

import { NextRequest } from "next/server";
import { getAccessContextWithRequest } from "@/lib/access/getAccessContext";
import { success, apiErrors } from "@/lib/api/standard-response";

export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) {
    return apiErrors.badRequest("venueId is required");
  }

  const ctx = await getAccessContextWithRequest(venueId, req);
  if (!ctx?.user_id || !ctx?.role) {
    return apiErrors.unauthorized("Unable to resolve access context");
  }

  return success({
    user_id: ctx.user_id,
    venue_id: ctx.venue_id,
    role: ctx.role,
    tier: ctx.tier ?? "starter",
  });
}
