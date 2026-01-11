import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { liveOrdersWindow, earlierTodayWindow, historyWindow } from "@/lib/dates";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

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

      // Try to get from cache first (1 minute TTL for dashboard orders)
      const cacheKey = `dashboard_orders:${venueId}:${status}:${scope}:${limit}`;
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

      // Get active tables count based on scope
      let activeTablesQuery = supabase
        .from("orders")
        .select("table_number")
        .eq("venue_id", venueId)
        .not("table_number", "is", null);

      if (scope === "live") {
        const timeWindow = liveOrdersWindow();
        activeTablesQuery = activeTablesQuery.gte("created_at", timeWindow.startUtcISO);
      } else if (scope === "earlier") {
        const timeWindow = earlierTodayWindow();
        activeTablesQuery = activeTablesQuery
          .gte("created_at", timeWindow.startUtcISO)
          .lt("created_at", timeWindow.endUtcISO);
      } else if (scope === "history") {
        const timeWindow = historyWindow();
        activeTablesQuery = activeTablesQuery.lt("created_at", timeWindow.endUtcISO);
      }

      const { data: activeTables } = await activeTablesQuery;

      const activeTablesToday = new Set(
        activeTables?.map(
          (o: Record<string, unknown>) => (o as { table_number?: string }).table_number
        ) || []
      ).size;

      const response = {

        },
      };

      // Cache the response for 1 minute (dashboard orders change frequently)
      await cache.set(cacheKey, response, { ttl: 60 });

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
    // STEP 9: Extract venueId from request (query params)

        const { searchParams } = new URL(req.url);
        return searchParams.get("venueId");
      } catch {
        return null;
      }
    },
  }
);
