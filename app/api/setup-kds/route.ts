import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    const req = _req;

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

    const supabaseAdmin = createAdminClient();

    // Create KDS Stations table
    const createStationsTable = `
      CREATE TABLE IF NOT EXISTS kds_stations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        venue_id TEXT NOT NULL,
        station_name TEXT NOT NULL,
        station_type TEXT,
        display_order INTEGER DEFAULT 0,
        color_code TEXT DEFAULT '#3b82f6',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(venue_id, station_name)
      );
    `;

    // Create KDS Tickets table
    const createTicketsTable = `
      CREATE TABLE IF NOT EXISTS kds_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        venue_id TEXT NOT NULL,
        order_id UUID NOT NULL,
        station_id UUID NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        special_instructions TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        ready_at TIMESTAMPTZ,
        bumped_at TIMESTAMPTZ,
        table_number INTEGER,
        table_label TEXT,
        priority INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Execute table creation
    const { error: stationsError } = await supabaseAdmin.rpc("exec", {
      query: createStationsTable,
    });

    if (stationsError) {
      logger.warn("[SETUP KDS] Stations table warning:", stationsError.message);
    }

    const { error: ticketsError } = await supabaseAdmin.rpc("exec", {
      query: createTicketsTable,
    });

    if (ticketsError) {
      logger.warn("[SETUP KDS] Tickets table warning:", ticketsError.message);
    }

    // Create indexes
    await supabaseAdmin.rpc("exec", {
      query: "CREATE INDEX IF NOT EXISTS idx_kds_tickets_venue ON kds_tickets(venue_id);",
    });

    await supabaseAdmin.rpc("exec", {
      query: "CREATE INDEX IF NOT EXISTS idx_kds_tickets_order ON kds_tickets(order_id);",
    });

    await supabaseAdmin.rpc("exec", {
      query: "CREATE INDEX IF NOT EXISTS idx_kds_tickets_station ON kds_tickets(station_id);",
    });

    await supabaseAdmin.rpc("exec", {
      query: "CREATE INDEX IF NOT EXISTS idx_kds_tickets_status ON kds_tickets(status);",
    });

    // Create default stations for existing venues
    const { data: venues } = await supabaseAdmin.from("venues").select("venue_id");

    if (venues && venues.length > 0) {
      for (const venue of venues) {
        const defaultStations = [
          { name: "Expo", type: "expo", order: 0, color: "#3b82f6" },
          { name: "Grill", type: "grill", order: 1, color: "#ef4444" },
          { name: "Fryer", type: "fryer", order: 2, color: "#f59e0b" },
          { name: "Barista", type: "barista", order: 3, color: "#8b5cf6" },
          { name: "Cold Prep", type: "cold", order: 4, color: "#06b6d4" },
        ];

        for (const station of defaultStations) {
          const { error: insertError } = await supabaseAdmin.from("kds_stations").upsert(
            {
              venue_id: venue.venue_id,
              station_name: station.name,
              station_type: station.type,
              display_order: station.order,
              color_code: station.color,
              is_active: true,
            },
            {
              onConflict: "venue_id,station_name",
            }
          );

          if (insertError) {
            logger.warn(
              `[SETUP KDS] Station creation warning for ${venue.venue_id}:`,
              insertError.message
            );
          }
        }
      }
    }


    return NextResponse.json({
      ok: true,
      message: "KDS setup completed successfully",
      venues_processed: venues?.length || 0,
    });
  } catch (_error) {
    logger.error("[SETUP KDS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "KDS setup failed",
      },
      { status: 500 }
    );
  }
}
