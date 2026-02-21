/**
 * GET /api/auth/access-context?venueId=xxx
 *
 * Client-side endpoint that returns the resolved auth context for a venue.
 * Uses the same resolveVenueAccess path as the server-side getAuthContext(),
 * so the client always sees the same role/tier as the server.
 *
 * This endpoint is the ONLY client-side path for obtaining role/tier.
 * Client components must NOT call the get_access_context RPC directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/unified-auth";
import { resolveVenueAccess } from "@/lib/auth/resolve-access";
import { normalizeVenueId } from "@/lib/utils/venueId";
import { TIER_LIMITS } from "@/lib/tier-restrictions";

export async function GET(req: NextRequest) {
  const { user, error: authError } = await getAuthUserFromRequest(req);

  if (authError || !user) {
    return NextResponse.json(
      {
        userId: null,
        venueId: null,
        role: null,
        tier: null,
        isAuthenticated: false,
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const rawVenueId = url.searchParams.get("venueId");
  const venueId = normalizeVenueId(rawVenueId);

  if (!venueId) {
    return NextResponse.json({ error: "venueId query parameter is required" }, { status: 400 });
  }

  const resolved = await resolveVenueAccess(user.id, venueId);

  if (!resolved) {
    return NextResponse.json({
      userId: user.id,
      venueId,
      role: null,
      tier: null,
      isAuthenticated: true,
    });
  }

  const tier = resolved.tier;
  const tierLimits = TIER_LIMITS[tier];

  return NextResponse.json({
    userId: resolved.userId,
    venueId: resolved.venueId,
    role: resolved.role,
    tier: resolved.tier,
    isAuthenticated: true,
    features: tierLimits
      ? {
          aiAssistant: tierLimits.features.aiAssistant,
          kds: tierLimits.features.kds !== false,
          inventory: tierLimits.features.inventory,
          analytics: tierLimits.features.analytics,
        }
      : null,
  });
}
