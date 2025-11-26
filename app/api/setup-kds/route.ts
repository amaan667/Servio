import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json(
          { error: "venue_id is required" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
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
          ticket_number INTEGER NOT NULL,
          status TEXT DEFAULT 'PENDING',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          bumped_at TIMESTAMPTZ,
          FOREIGN KEY (station_id) REFERENCES kds_stations(id),
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
      `;

      // Execute table creation (using admin client for DDL operations)
      const { error: stationsError } = await supabaseAdmin.rpc('exec_sql', {
        sql: createStationsTable,
      });

      if (stationsError) {
        logger.error("[SETUP KDS] Error creating stations table:", {
          error: stationsError,
          venueId,
          userId: context.user.id,
        });
        // Continue anyway - table might already exist
      }

      const { error: ticketsError } = await supabaseAdmin.rpc('exec_sql', {
        sql: createTicketsTable,
      });

      if (ticketsError) {
        logger.error("[SETUP KDS] Error creating tickets table:", {
          error: ticketsError,
          venueId,
          userId: context.user.id,
        });
        // Continue anyway - table might already exist
      }

      // Create default stations for this venue
      const defaultStations = [
        { name: "Expo", type: "expo", order: 0, color: "#3b82f6" },
        { name: "Grill", type: "grill", order: 1, color: "#ef4444" },
        { name: "Fryer", type: "fryer", order: 2, color: "#f59e0b" },
        { name: "Barista", type: "barista", order: 3, color: "#8b5cf6" },
        { name: "Cold Prep", type: "cold", order: 4, color: "#06b6d4" },
      ];

      for (const station of defaultStations) {
        await supabaseAdmin.from("kds_stations").upsert(
          {
            venue_id: venueId,
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
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "KDS setup completed successfully",
        venueId,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[SETUP KDS] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venueId || body?.venue_id;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);
