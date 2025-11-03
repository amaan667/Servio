import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const supabaseAdmin = createAdminClient();

    // Get the most recent paid order from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          menu_item_id,
          item_name,
          quantity,
          price,
          special_instructions
        )
      `
      )
      .eq("payment_status", "PAID")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      logger.error("[RECENT PAID] Error fetching recent order:", orderError);
      return NextResponse.json(
        {
          error: "Failed to fetch recent order",
          details: orderError.message,
        },
        { status: 500 }
      );
    }

    if (!recentOrder) {
      return NextResponse.json(
        {
          error: "No recent paid orders found",
        },
        { status: 404 }
      );
    }

    logger.debug("[RECENT PAID] Found recent paid order:", {
      id: recentOrder.id,
      customer: recentOrder.customer_name,
      table: recentOrder.table_number,
      total: recentOrder.total_amount,
      payment_method: recentOrder.payment_method,
      payment_status: recentOrder.payment_status,
      stripe_session_id: recentOrder.stripe_session_id,
      stripe_payment_intent_id: recentOrder.stripe_payment_intent_id,
      items_count: recentOrder.order_items?.length || 0,
    });

    // Transform the order to include items array
    const transformedOrder = {
      ...recentOrder,
      items: recentOrder.order_items || [],
    };

    // Remove the order_items property since we have items now
    delete transformedOrder.order_items;

    return NextResponse.json({
      order: transformedOrder,
    });
  } catch (_error) {
    logger.error("[RECENT PAID] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}
