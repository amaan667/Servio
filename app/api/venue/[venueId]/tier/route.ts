import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await context.params;
    
    // CRITICAL: Authentication and venue access verification
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    if (!venueId) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Get venue with organization data
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select(
        `
        venue_id,
        venue_name,
        organization_id,
        organizations (
          id,
          subscription_tier,
          subscription_status
        )
      `
      )
      .eq("venue_id", venueId)
      .single();

    if (venueError || !venue) {
      logger.error("[VENUE TIER API] Venue not found:", { venueId, error: venueError });
      return NextResponse.json(
        {
          tier: "starter",
          status: "active",
        },
        { status: 200 }
      );
    }

    const organization = Array.isArray(venue.organizations)
      ? venue.organizations[0]
      : venue.organizations;

    return NextResponse.json({
      tier: organization?.subscription_tier || "starter",
      status: organization?.subscription_status || "active",
    });
  } catch (_error) {
    logger.error("[VENUE TIER API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        tier: "starter",
        status: "active",
      },
      { status: 200 }
    );
  }
}
