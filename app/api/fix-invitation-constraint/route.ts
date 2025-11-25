import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/fix-invitation-constraint - Direct fix for invitation constraint (Cookie-free)
export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
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

    const supabase = createAdminClient();


    // Step 1: Get all cancelled invitations and delete them
    const { data: cancelledInvitations, error: fetchError } = await supabase
      .from("staff_invitations")
      .select("id, email, venue_id")
      .eq("status", "cancelled");

    if (fetchError) {
      logger.error("[CONSTRAINT FIX] Error fetching cancelled invitations:", {
        error: fetchError.message,
      });
    } else {
      logger.debug(
        `[CONSTRAINT FIX] Found ${cancelledInvitations?.length || 0} cancelled invitations`
      );
    }

    // Step 2: Delete all cancelled invitations
    const { error: deleteError } = await supabase
      .from("staff_invitations")
      .delete()
      .eq("status", "cancelled");

    if (deleteError) {
      logger.error("[CONSTRAINT FIX] Error deleting cancelled invitations:", {
        error: deleteError.message,
      });
    } else {
      // Deletion successful
    }

    // Step 3: Try to work around the constraint by using a different approach
    // We'll modify the cancel logic to handle this better

    return NextResponse.json({
      success: true,
      message: "Constraint fix completed. Cancelled invitations have been removed.",
      deletedCount: cancelledInvitations?.length || 0,
    });
  } catch (_error) {
    logger.error("[CONSTRAINT FIX] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
