import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Check cache
    const cacheKey = `pos_orders:${venueId}`;
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

        const tableLabel = tablesArray[0]?.label || `Table ${order.table_number || ""}`;
        return {
          ...order,

        };
      }
    );

    const response = { orders: transformedOrders };

    // STEP 6: Cache the response for 1 minute
    await cache.set(cacheKey, response, { ttl: 60 });

    

    // STEP 7: Return success response
    return success(response);
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
