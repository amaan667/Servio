import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireAuthForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Add authentication
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }

    // CRITICAL: Add rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.PAYMENT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // CRITICAL: Verify user has access to this order's venue
    const { data: order } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { requireVenueAccessForAPI } = await import("@/lib/auth/api");
    const venueAccessResult = await requireVenueAccessForAPI(order.venue_id);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // Get the order details to find table_id (venue_id already fetched above)
    const { data: orderData, error: fetchError } = await supabase
      .from("orders")
      .select("table_id")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      logger.error("Failed to fetch order:", { value: fetchError });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update payment status
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "PAID",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      logger.error("Failed to mark order as paid:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this is a table order, check if reservations should be auto-completed
    if (orderData?.table_id) {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
        const completionResponse = await fetch(`${baseUrl}/api/reservations/check-completion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            venueId: order.venue_id,
            tableId: orderData.table_id,
          }),
        });

        if (completionResponse.ok) {
          await completionResponse.json();
        }
      } catch (completionError) {
        logger.error("[MARK PAID] Error checking reservation completion:", {
          value: completionError,
        });
        // Don't fail the main request if completion check fails
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      payment_status: "PAID",
      updated_at: new Date().toISOString(),
    });
  } catch (_error) {
    logger.error("[MARK PAID] Error marking order as paid:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Unknown _error" },
      { status: 500 }
    );
  }
}
