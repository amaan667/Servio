import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/monitoring/structured-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidStripeSessionId(value: string): boolean {
  return /^cs_[a-zA-Z0-9_]+$/.test(value);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return apiErrors.badRequest("Session ID is required");
    }

    if (!isValidStripeSessionId(sessionId)) {
      return apiErrors.badRequest("Invalid session ID format");
    }

    const supabaseAdmin = createAdminClient();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        venue_id,
        table_number,
        table_id,
        customer_name,
        customer_phone,
        customer_email,
        items,
        total_amount,
        order_status,
        payment_status,
        payment_method,
        stripe_session_id,
        stripe_payment_intent_id,
        created_at,
        updated_at,
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
      .eq("stripe_session_id", sessionId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          error: "Order not found for this session ID",
        },
        { status: 404 }
      );
    }

    const { order_items: orderItems, ...orderWithoutItems } = order;
    const transformedOrder = {
      ...orderWithoutItems,
      items: orderItems || order.items || [],
    };

    return NextResponse.json({
      order: transformedOrder,
    });
  } catch (error) {
    logger.error("[orders/by-session] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
