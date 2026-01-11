import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
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
        
        return NextResponse.json(
          {

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
        
      }

      const status = {

      };

      return NextResponse.json({

        status,

    } catch (_error) {
      
      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }
  },
  {

      const { searchParams } = new URL(req.url);
      const { venueId } = validateQuery(
        paginationSchema.pick({ limit: true, offset: true }).extend({

        }),
        {

          // keep shape for validation; limit/offset ignored here

        }
      );
      return venueId;
    },
  }
);
