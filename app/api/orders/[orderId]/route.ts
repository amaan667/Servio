import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SingleOrderRouteContext = {
  params?: {
    orderId?: string;
  };
};

export async function GET(_req: Request, context?: SingleOrderRouteContext) {
  try {
    const supabaseAdmin = createAdminClient();
    const orderId = context?.params?.orderId;

    if (!orderId) {
      return apiErrors.badRequest('Order ID is required');
    }

    // Fetch order with items (items are stored as JSONB in orders table)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    logger.debug("[ORDER FETCH DEBUG] Query result:", {
      data: { found: !!order, error: orderError, keys: order ? Object.keys(order) : "N/A" },
    });

    if (orderError) {
      logger.error("[ORDER FETCH DEBUG] ===== ORDER NOT FOUND =====");
      logger.error("[ORDER FETCH DEBUG] Error fetching order:", { value: orderError });
      return NextResponse.json(
        {
          error: "Order not found",
        },
        { status: 404 }
      );
    }

    if (!order) {
      logger.error("[ORDER FETCH DEBUG] ===== NO ORDER DATA =====");
      return NextResponse.json(
        {
          error: "Order not found",
        },
        { status: 404 }
      );
    }

    // Log payment details

    // Items are already in the order object as JSONB
    // Ensure items array exists (fallback to empty array if null)
    const transformedOrder = {
      ...order,
      items: order.items || [],
    };

    logger.debug(
      "[ORDER FETCH DEBUG] Items count:",
      Array.isArray(transformedOrder.items) ? transformedOrder.items.length : 0
    );

    return NextResponse.json({
      order: transformedOrder,
    });
  } catch (_error) {
    logger.error("[ORDER FETCH] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
