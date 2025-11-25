import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

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

    const body = await req.json();
    const { venue_id, table_number, table_label, seat_count = 4, area = null } = body;

    if (!venue_id || !table_number) {
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
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // Check if table already exists first
    const { data: existingTable } = await supabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", venue_id)
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
          venue_id: venue_id,
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
      .eq("venue_id", venue_id)
      .maybeSingle();

    // Only create session if one doesn't already exist
    if (!existingSession) {
      const { error: sessionError } = await supabase.from("table_sessions").insert({
        venue_id: venue_id,
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
}
