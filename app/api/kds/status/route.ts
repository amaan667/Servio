import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusQuerySchema = z.object({
  venueId: z.string().min(1).max(64),
});

export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const supabaseAdmin = createAdminClient();
    const venueId = context.venueId;

    // Check if KDS tables exist (schema-level validation, no venue data exposed)
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from("information_schema.tables")
      .select("table_name")
      .in("table_name", ["kds_stations", "kds_tickets", "kds_station_categories"])
      .eq("table_schema", "public");

    if (tablesError) {
      return apiErrors.internal("Failed to check KDS tables");
    }

    const tableNames = tables?.map((t) => t.table_name) || [];

    // Check if there are unknown KDS stations (venue scoped)
    let stationsCount = 0;
    let ticketsCount = 0;

    if (tableNames.includes("kds_stations")) {
      const { count: stationsCountResult } = await supabaseAdmin
        .from("kds_stations")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", venueId);
      stationsCount = stationsCountResult || 0;
    }

    if (tableNames.includes("kds_tickets")) {
      const { count: ticketsCountResult } = await supabaseAdmin
        .from("kds_tickets")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", venueId);
      ticketsCount = ticketsCountResult || 0;
    }

    // Check recent orders to see if unknown should have KDS tickets
    const { data: recentOrders } = await supabaseAdmin
      .from("orders")
      .select("id, customer_name, table_number, order_status, payment_status, created_at")
      .eq("order_status", "PLACED")
      .eq("venue_id", venueId)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
      .order("created_at", { ascending: false })
      .limit(5);

    const status = {
      kds_tables_exist: tableNames.length === 3,
      tables_found: tableNames,
      stations_count: stationsCount,
      tickets_count: ticketsCount,
      recent_orders: recentOrders || [],
      system_ready: tableNames.length === 3 && stationsCount > 0,
      venue_id: venueId,
    };

    return success({
      ok: true,
      status,
    });
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.KDS,
  }
);
