import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const supabaseAdmin = createAdminClient();
    const { sessionId } = await params;


    if (!sessionId) {
      logger.error("[ORDER SESSION LOOKUP DEBUG] No session ID provided");
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Look up order by stripe_session_id with all fields including Stripe details
    // Items are stored as JSONB in orders table, not in separate order_items table
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .single();

    logger.debug("[ORDER SESSION LOOKUP DEBUG] Query result:", {
      data: { found: !!order, error: orderError, order },
    });

    if (orderError) {
      logger.error("[ORDER SESSION LOOKUP DEBUG] Database error:", { value: orderError });
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found for this session",
        },
        { status: 404 }
      );
    }

    if (!order) {
      logger.error("[ORDER SESSION LOOKUP DEBUG] No order found for session:", {
        value: sessionId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found for this session",
        },
        { status: 404 }
      );
    }

    logger.debug("[ORDER SESSION LOOKUP DEBUG] Order details:", {
      id: order.id,
      customer_name: order.customer_name,
      table_number: order.table_number,
      venue_id: order.venue_id,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      order_status: order.order_status,
      stripe_session_id: order.stripe_session_id,
      stripe_payment_intent_id: order.stripe_payment_intent_id,
      items_count: Array.isArray(order.items) ? order.items.length : 0,
    });

    // Items are already in the order object as JSONB
    // Ensure items array exists (fallback to empty array if null)
    const transformedOrder = {
      ...order,
      items: order.items || [],
    };

    logger.debug(
      "[ORDER SESSION LOOKUP DEBUG] Transformed order keys:",
      Object.keys(transformedOrder)
    );

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      order: transformedOrder,
    });
  } catch (_error) {
    logger.error("[ORDER SESSION LOOKUP DEBUG] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
