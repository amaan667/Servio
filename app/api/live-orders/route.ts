import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { cacheKeys, RECOMMENDED_TTL } from "@/lib/cache/constants";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const GET = createUnifiedHandler(async (_req: NextRequest, context) => {
  try {
    // Rate limiting handled by unified handler
    const venueId = context.venueId;

    // Try to get from cache first (using standardized cache keys)
    const cacheKey = cacheKeys.order.live(venueId);
    const cachedOrders = await cache.get(cacheKey);

    if (cachedOrders) {
      return success(cachedOrders);
    }

    // Use authenticated client instead of admin client
    const supabase = await createClient();

    // Get live orders - show both paid and unpaid orders
    const { data: orders, error } = await supabase
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
      .in("payment_status", ["PAID", "UNPAID"]) // Show both paid and unpaid orders
      .in("order_status", ["PLACED", "IN_PREP", "READY"])
      .order("created_at", { ascending: false });

    if (error) {

      return apiErrors.database(error.message);
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

    const response = {
      orders: transformedOrders,
    };

    // Cache the response using recommended TTL
    await cache.set(cacheKey, response, { ttl: RECOMMENDED_TTL.LIVE_ORDERS });

    return success(response);
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
    const errorStack = _error instanceof Error ? _error.stack : undefined;

    // Check if it's an authentication/authorization error
    if (errorMessage.includes("Unauthorized")) {
      return apiErrors.unauthorized(errorMessage);
    }
    if (errorMessage.includes("Forbidden")) {
      return apiErrors.forbidden(errorMessage);
    }

    return apiErrors.internal(
      isDevelopment() ? errorMessage : "Failed to fetch live orders",
      isDevelopment() && errorStack ? { stack: errorStack } : undefined
    );
  }
}, {
  requireVenueAccess: true,
  venueIdSource: "query",
  rateLimit: RATE_LIMITS.GENERAL,
});
