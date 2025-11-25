import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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

    const supabase = await createClient();

    // Check if user is authenticated
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const venueIdFromBody = body?.venueId || body?.venue_id;
    const resetType = body?.resetType || "all";
    
    // Use venueId from auth check or body
    const finalVenueId = venueId || venueIdFromBody;

    let result;

    if (resetType === "venue" && finalVenueId) {
      // Delete specific venue tables
      const { data, error } = await supabase.rpc("delete_venue_tables", {
        p_venue_id: finalVenueId,
      });

      if (error) {
        logger.error("[AUTH DEBUG] Venue deletion error:", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    } else {
      // Delete all tables
      const { data, error } = await supabase.rpc("manual_table_deletion", {
        p_venue_id: null,
      });

      if (error) {
        logger.error("[AUTH DEBUG] Manual deletion error:", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (_error) {
    logger.error("[AUTH DEBUG] Table reset API error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check reset logs
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get recent deletion logs
    const { data, error } = await supabase
      .from("table_deletion_logs")
      .select("*")
      .order("deletion_timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("[AUTH DEBUG] Reset logs error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (_error) {
    logger.error("[AUTH DEBUG] Reset logs API error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
