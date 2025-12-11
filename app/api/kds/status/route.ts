import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors } from "@/lib/api/standard-response";
import { validateQuery, paginationSchema } from "@/lib/api/validation-schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUnifiedAuth(
  async (req, context) => {
    try {
      const rateResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
      }

      const supabaseAdmin = createAdminClient();

      // Check if KDS tables exist (schema-level validation, no venue data exposed)
      const { data: tables, error: tablesError } = await supabaseAdmin
        .from("information_schema.tables")
        .select("table_name")
        .in("table_name", ["kds_stations", "kds_tickets", "kds_station_categories"])
        .eq("table_schema", "public");

      if (tablesError) {
        logger.error("[KDS STATUS] Error checking tables:", { error: tablesError.message });
        return NextResponse.json(
          {
            error: "Failed to check KDS tables",
            details: tablesError.message,
          },
          { status: 500 }
        );
      }

      const tableNames = tables?.map((t) => t.table_name) || [];

      // Check if there are unknown KDS stations (venue scoped)
      let stationsCount = 0;
      let ticketsCount = 0;

      if (tableNames.includes("kds_stations")) {
        const { count: stationsCountResult } = await supabaseAdmin
          .from("kds_stations")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", context.venueId);
        stationsCount = stationsCountResult || 0;
      }

      if (tableNames.includes("kds_tickets")) {
        const { count: ticketsCountResult } = await supabaseAdmin
          .from("kds_tickets")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", context.venueId);
        ticketsCount = ticketsCountResult || 0;
      }

      // Check recent orders to see if unknown should have KDS tickets
      const { data: recentOrders, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select("id, customer_name, table_number, order_status, payment_status, created_at")
        .eq("order_status", "PLACED")
        .eq("venue_id", context.venueId)
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
        .order("created_at", { ascending: false })
        .limit(5);

      if (ordersError) {
        logger.error("[KDS STATUS] Error checking recent orders:", {
          error: ordersError.message,
          venueId: context.venueId,
        });
      }

      const status = {
        kds_tables_exist: tableNames.length === 3,
        tables_found: tableNames,
        stations_count: stationsCount,
        tickets_count: ticketsCount,
        recent_orders: recentOrders || [],
        system_ready: tableNames.length === 3 && stationsCount > 0,
        venue_id: context.venueId,
      };

      return NextResponse.json({
        ok: true,
        status,
      });
    } catch (_error) {
      logger.error("[KDS STATUS] Error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
        venueId: context.venueId,
      });
      return NextResponse.json(
        {
          error: "Internal server error",
          details: _error instanceof Error ? _error.message : "Unknown _error",
        },
        { status: 500 }
      );
    }
  },
  {
    extractVenueId: async (req) => {
      const { searchParams } = new URL(req.url);
      const { venueId } = validateQuery(
        paginationSchema
          .pick({ limit: true, offset: true })
          .extend({
            venueId: z.string().min(1).max(64),
          }),
        {
          venueId: searchParams.get("venueId"),
          // keep shape for validation; limit/offset ignored here
          limit: searchParams.get("limit") ?? undefined,
          offset: searchParams.get("offset") ?? undefined,
        }
      );
      return venueId;
    },
  }
);
