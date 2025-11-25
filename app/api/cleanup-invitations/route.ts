import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/cleanup-invitations - Clean up cancelled invitations and fix constraint (Cookie-free)
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
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI(req);
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


    // Step 1: Delete all cancelled invitations to clean up the database
    const { data: deletedInvitations, error: deleteError } = await supabase
      .from("staff_invitations")
      .delete()
      .eq("status", "cancelled")
      .select("id, email, venue_id");

    if (deleteError) {
      logger.error("[CLEANUP] Error deleting cancelled invitations:", {
        error: deleteError.message || "Unknown error",
      });
      return NextResponse.json(
        {
          error: "Failed to clean up cancelled invitations",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }


    // Step 2: Try to fix the database constraint
    try {
      // Drop the problematic constraint
      await supabase.rpc("exec_sql", {
        sql: "ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;",
      });

      // Create the new partial unique index
      await supabase.rpc("exec_sql", {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
              ON staff_invitations (venue_id, email) 
              WHERE status = 'pending';`,
      });

    } catch (constraintError) {
      logger.warn("[CLEANUP] Could not fix constraint (this is okay)", {
        error: constraintError instanceof Error ? constraintError.message : "Unknown error",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed successfully. Deleted ${deletedInvitations?.length || 0} cancelled invitations.`,
      deletedCount: deletedInvitations?.length || 0,
    });
  } catch (_error) {
    logger.error("[CLEANUP] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
