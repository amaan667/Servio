import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// GET /api/tables/secondary?primary_table_id=xxx&venue_id=xxx - Find secondary table for a primary table
export async function GET(req: NextRequest) {
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

    
    const primaryTableId = searchParams.get("primary_table_id");

    if (!primaryTableId || !venueId) {
      return NextResponse.json(
        { ok: false, error: "primary_table_id and venue_id are required" },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Find the secondary table that is merged with the primary table
    const { data: secondaryTable, error: secondaryTableError } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", venueId)
      .eq("merged_with_table_id", primaryTableId)
      .single();

    if (secondaryTableError) {
      logger.error("[TABLES SECONDARY GET] Error finding secondary table:", secondaryTableError);
      if (secondaryTableError.code === "PGRST116") {
        return NextResponse.json(
          { ok: false, error: "No secondary table found for this primary table" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: false, error: secondaryTableError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      table: secondaryTable,
    });
  } catch (_error) {
    logger.error("[TABLES SECONDARY GET] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
