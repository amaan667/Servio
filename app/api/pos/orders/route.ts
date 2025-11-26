import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const { searchParams } = new URL(req.url);
      const isActive = searchParams.get("is_active") === "true";
      const status = searchParams.get("status");
      const station = searchParams.get("station");
      const venueId = context.venueId;

    // Try to get from cache first (1 minute TTL for POS orders)
    const cacheKey = `pos_orders:${venueId}:${isActive}:${status}:${station}`;
    const cachedOrders = await cache.get(cacheKey);

    if (cachedOrders) {
      return NextResponse.json(cachedOrders);
    }

    // Use authenticated client instead of admin client
    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select(
        `
        *,
        tables!left (
          id,
          label,
          area
        )
      `
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (isActive) {
      query = query.eq("is_active", true);
    }

    if (status) {
      query = query.eq("order_status", status);
    }

    if (station) {
      // Filter by items that have the specified station
      query = query.contains("items", [{ station }]);
    }

    const { data: orders, error } = await query;

    if (error) {
      logger.error("[POS ORDERS] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform orders to include table_label
    const transformedOrders =
      orders?.map((order) => ({
        ...order,
        table_label: order.tables?.label || `Table ${order.table_number}`,
      })) || [];

    const response = { orders: transformedOrders };

    // Cache the response for 1 minute (POS orders change frequently)
    await cache.set(cacheKey, response, { ttl: 60 });

    return NextResponse.json(response);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS ORDERS] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
      });
      
      // Check if it's an authentication/authorization error
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
          message: process.env.NODE_ENV === "development" ? errorMessage : "Failed to fetch POS orders",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  }
);
