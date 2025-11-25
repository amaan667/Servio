import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");
    const isActive = searchParams.get("is_active") === "true";
    const status = searchParams.get("status");
    const station = searchParams.get("station");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // CRITICAL: Add authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Add rate limiting
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
    logger.error("[POS ORDERS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
