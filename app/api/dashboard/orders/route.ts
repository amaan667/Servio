import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { cacheKeys, RECOMMENDED_TTL } from "@/lib/cache/constants";

import { liveOrdersWindow, earlierTodayWindow, historyWindow } from "@/lib/dates";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const GET = createUnifiedHandler(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting handled by unified handler
      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status") || "all";
      const limit = parseInt(searchParams.get("limit") || "50");
      const scope = searchParams.get("scope") || "live";

      // STEP 4: Validate inputs
      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // Try to get from cache first (using standardized cache keys)
      const cacheKey = cacheKeys.order.dashboard(venueId, status, scope);
      const cachedOrders = await cache.get(cacheKey);

      if (cachedOrders) {
        return success(cachedOrders);
      }

      // Use authenticated client instead of admin client
      const supabase = await createClient();

      let query = supabase
        .from("orders")
        .select(
          `
      id, venue_id, table_number, table_id, customer_name, customer_phone, 
      total_amount, order_status, payment_status, notes, created_at, items, source,
      tables!left (
        id,
        label,
        area
      )
    `
        )
        .eq("venue_id", venueId)
        // Filter out abandoned PAY_NOW orders (UNPAID + PAY_NOW)
        // We want: PAID orders OR (UNPAID orders that are NOT PAY_NOW)
        .or("payment_status.eq.PAID,and(payment_status.eq.UNPAID,payment_method.neq.PAY_NOW)")
        .order("created_at", { ascending: false })
        .limit(limit);

      // Apply status filter
      if (status !== "all") {
        query = query.eq("order_status", status);
      }

      // Apply date scope filter
      if (scope === "live") {
        // Live orders: last 30 minutes only
        const timeWindow = liveOrdersWindow();
        query = query.gte("created_at", timeWindow.startUtcISO);
      } else if (scope === "earlier") {
        // Earlier today: orders from today but more than 30 minutes ago
        const timeWindow = earlierTodayWindow();
        query = query
          .gte("created_at", timeWindow.startUtcISO)
          .lt("created_at", timeWindow.endUtcISO);
      } else if (scope === "history") {
        // History: orders from yesterday and earlier
        const timeWindow = historyWindow();
        query = query.lt("created_at", timeWindow.endUtcISO);
      }

      const { data: orders, error } = await query;

      if (error) {
        return apiErrors.internal(error instanceof Error ? error.message : "Unknown error");
      }

      // Transform orders to include table_label
      const transformedOrders =
        orders?.map((order) => ({
          ...order,
          table_label:
            (order.tables as { label?: string } | null)?.label ||
            (order.source === "counter"
              ? `Counter ${order.table_number}`
              : `Table ${order.table_number}`),
        })) || [];

      // Detailed logging for Railway deployment monitoring (disabled for performance)
      // if (orders && orders.length > 0) {
      //   // Age distribution analysis
      //   const ageDistribution = orders.reduce((acc, order) => {
      //     const orderDate = new Date(order.created_at);
      //     const ageMinutes = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60));
      //     if (ageMinutes < 30) acc['<30min'] = (acc['<30min'] || 0) + 1;
      //     else if (ageMinutes < 60) acc['30-60min'] = (acc['30-60min'] || 0) + 1;
      //     else if (ageMinutes < 1440) acc['1-24hrs'] = (acc['1-24hrs'] || 0) + 1;
      //     else acc['>24hrs'] = (acc['>24hrs'] || 0) + 1;
      //     return acc;
      //   }, { /* Empty */ } as Record<string, number>);
      //
      //
      //   // Status distribution
      //   const statusDistribution = orders.reduce((acc, order) => {
      //     acc[order.order_status] = (acc[order.order_status] || 0) + 1;
      //     return acc;
      //   }, { /* Empty */ } as Record<string, number>);
      //
      // }

      // Get active tables count based on scope - optimized to use existing orders data
      // Instead of a separate query, derive from the orders we already fetched
      const activeTablesSet = new Set<string>();
      transformedOrders.forEach((order) => {
        if (order.table_number) {
          activeTablesSet.add(String(order.table_number));
        }
      });

      const activeTablesToday = activeTablesSet.size;

      const response = {
        ok: true,
        orders: transformedOrders,
        meta: {
          activeTablesToday,
          total: transformedOrders?.length || 0,
        },
      };

      // Cache the response using recommended TTL
      await cache.set(cacheKey, response, { ttl: RECOMMENDED_TTL.DASHBOARD_COUNTS });

      // STEP 7: Return success response
      return success(response);
    } catch (_error) {
      // STEP 8: Consistent error handling
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      if (errorMessage.includes("Unauthorized")) {
        return apiErrors.unauthorized(errorMessage);
      }
      if (errorMessage.includes("Forbidden")) {
        return apiErrors.forbidden(errorMessage);
      }

      return apiErrors.internal(
        isDevelopment() ? errorMessage : "Request processing failed",
        isDevelopment() && errorStack ? { stack: errorStack } : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
