import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { venue_id, table_number, table_label, seat_count = 4, area = null } = body;
    const finalVenueId = context.venueId || venue_id;

    if (!finalVenueId || !table_number) {
      return NextResponse.json(
        {
          success: false,
          error: "venue_id and table_number are required",
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      env("NEXT_PUBLIC_SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(_name: string, _value: string, _options: unknown) {
            /* Empty */
          },
          remove(_name: string, _options: unknown) {
            /* Empty */
          },
        },
      }
    );

    // Check tier limits for table count (only when creating new table)
    const { checkLimit } = await import("@/lib/tier-restrictions");
    const { createAdminClient } = await import("@/lib/supabase");
    const adminSupabase = createAdminClient();

    // Get venue owner to check tier limits
    const { data: venue } = await adminSupabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", finalVenueId)
      .single();

    if (!venue) {
      return NextResponse.json(
        {
          success: false,
          error: "Venue not found",
        },
        { status: 404 }
      );
    }

    // Count current tables (active only)
    const { count: currentTableCount } = await adminSupabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", finalVenueId)
      .eq("is_active", true);

    const tableCount = currentTableCount || 0;

    // Check tier limit
    const limitCheck = await checkLimit(venue.owner_user_id, "maxTables", tableCount);
    if (!limitCheck.allowed) {
      logger.warn("[AUTO CREATE TABLE] Table limit reached", {
        userId: context.user.id,
        ownerUserId: venue.owner_user_id,
        currentCount: tableCount,
        limit: limitCheck.limit,
        tier: limitCheck.currentTier,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Table limit reached. You have ${tableCount}/${limitCheck.limit} tables. Upgrade to ${limitCheck.currentTier === "starter" ? "Pro" : "Enterprise"} tier for more tables.`,
          limitReached: true,
          currentCount: tableCount,
          limit: limitCheck.limit,
          tier: limitCheck.currentTier,
        },
        { status: 403 }
      );
    }

    // Check if table already exists first
    const { data: existingTable } = await supabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", finalVenueId)
      .eq("label", table_label || table_number.toString())
      .eq("is_active", true)
      .maybeSingle();

    let table;
    if (existingTable) {
      table = existingTable;
    } else {
      // Insert new table
      const { data: newTable, error: tableError } = await supabase
        .from("tables")
        .insert({
          venue_id: finalVenueId,
          label: table_label || table_number.toString(),
          seat_count: seat_count,
          area: area,
          is_active: true,
        })
        .select()
        .single();

      if (tableError) {
        logger.error("[AUTO CREATE TABLE] Table creation error:", {
          error: tableError instanceof Error ? tableError.message : "Unknown error",
        });
        return NextResponse.json(
          {
            success: false,
            error: "Failed to create table",
          },
          { status: 500 }
        );
      }
      table = newTable;
    }

    // Check if session already exists for this table
    const { data: existingSession } = await supabase
      .from("table_sessions")
      .select("id")
      .eq("table_id", table.id)
      .eq("venue_id", finalVenueId)
      .maybeSingle();

    // Only create session if one doesn't already exist
    if (!existingSession) {
      const { error: sessionError } = await supabase.from("table_sessions").insert({
        venue_id: finalVenueId,
        table_id: table.id,
        status: "FREE",
        opened_at: new Date().toISOString(),
        closed_at: null,
      });

      if (sessionError) {
        logger.error("[AUTO CREATE TABLE] Session creation error:", sessionError);
        // Don't fail the request if session creation fails, table is still created
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        table_id: table.id,
        table_label: table.label,
        was_created: true,
      },
    });
  } catch (_error) {
    logger.error("[AUTO CREATE TABLE] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
});
