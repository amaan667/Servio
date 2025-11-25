import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venueId");

  if (!venueId) {
    return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
  }

  // CRITICAL: Add authentication and venue access verification
  const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
  if (!venueAccessResult.success) {
    return venueAccessResult.response;
  }

  // CRITICAL: Add rate limiting
  const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many requests",
        message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
      },
      { status: 429 }
    );
  }

  // Try to get from cache first (30 second TTL for live orders)
  const cacheKey = `live_orders:${venueId}`;
  const cachedOrders = await cache.get(cacheKey);

  if (cachedOrders) {
    return NextResponse.json(cachedOrders);
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
    logger.error("[LIVE ORDERS] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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
    ok: true,
    orders: transformedOrders,
  };

  // Cache the response for 30 seconds (live orders change frequently)
  await cache.set(cacheKey, response, { ttl: 30 });

  return NextResponse.json(response);
}
