import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// POST /api/tables/[tableId]/seat - Seat a party at a table
export async function POST(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
      try {
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

        const { tableId } = await routeParams!.params!;
        const body = await req.json();
    const { reservationId, serverId } = body;

    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId is required" }, { status: 400 });
    }

    // Use admin client - no auth needed
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Get table info
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", tableId)
      .eq("venue_id", authContext.venueId)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ ok: false, error: "Table not found" }, { status: 404 });
    }

    // Call the database function to seat the party
    const { error } = await supabase.rpc("api_seat_party", {
      p_table_id: tableId,
      p_venue_id: authContext.venueId,
      p_reservation_id: reservationId || null,
      p_server_id: serverId || null,
    });

    if (error) {
      logger.error("[TABLES SEAT] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Party seated successfully",
    });
      } catch (_error) {
        logger.error("[TABLES SEAT] Unexpected error:", {
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
      }
    },
    {
      extractVenueId: async (req, routeParams) => {
        // Get venueId from table record
        if (routeParams?.params) {
          const params = await routeParams.params;
          const tableId = params?.tableId;
          if (tableId) {
            const adminSupabase = createAdminClient();
            const { data: table } = await adminSupabase
              .from("tables")
              .select("venue_id")
              .eq("id", tableId)
              .single();
            if (table?.venue_id) {
              return table.venue_id;
            }
          }
        }
        // Fallback to query/body
        const url = new URL(req.url);
        return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
      },
    }
  );

  return handler(req, context);
}
