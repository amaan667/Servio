import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { cacheKeys, RECOMMENDED_TTL } from "@/lib/cache/constants";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    try {
      // Rate limiting handled by unified handler
      // Get venueId from context
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // Check cache using standardized keys
      const cacheKey = cacheKeys.order.pos(venueId);
      const cachedOrders = await cache.get(cacheKey);

      if (cachedOrders) {
        return success(cachedOrders);
      }

      // STEP 4: Business logic - Fetch orders
      const supabase = await createClient();

      const { data: orders, error: fetchError } = await supabase
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
        .in("payment_status", ["PAID", "UNPAID"])
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"])
        .order("created_at", { ascending: false });

      if (fetchError) {
        return apiErrors.database(
          "Failed to fetch POS orders",
          isDevelopment() ? fetchError.message : undefined
        );
      }

      // STEP 5: Transform orders to include table_label
      const transformedOrders = (orders || []).map(
        (order: {
          table_number?: number;
          tables?: Array<{ label?: string }> | { label?: string };
          [key: string]: unknown;
        }) => {
          const tablesArray = Array.isArray(order.tables)
            ? order.tables
            : order.tables
              ? [order.tables]
              : [];
          const tableLabel = tablesArray[0]?.label || `Table ${order.table_number || ""}`;
          return {
            ...order,
            table_label: tableLabel,
          };
        }
      );

      const response = { orders: transformedOrders };

      // Cache the response using recommended TTL
      await cache.set(cacheKey, response, { ttl: RECOMMENDED_TTL.DASHBOARD_COUNTS });

      // STEP 7: Return success response
      return success(response);
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
