import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      env("NEXT_PUBLIC_SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
      {

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
      
      return NextResponse.json(
        {

          error: `Table limit reached. You have ${tableCount}/${limitCheck.limit} tables. Upgrade to ${limitCheck.currentTier === "starter" ? "Pro" : "Enterprise"} tier for more tables.`,

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

        .select()
        .single();

      if (tableError) {
        
        return NextResponse.json(
          {

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

      if (sessionError) {
        
        // Don't fail the request if session creation fails, table is still created
      }
    }

    return NextResponse.json({

      },

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
