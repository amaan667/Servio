import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/monitoring/structured-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionParams = { params?: { sessionId?: string } };

function isValidStripeSessionId(value: string): boolean {
  return /^cs_[a-zA-Z0-9_]+$/.test(value);
}

export async function GET(_req: Request, context: SessionParams = {}) {
  try {
    const sessionId = context.params?.sessionId;

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
        "id, venue_id, table_number, table_id, customer_name, customer_phone, customer_email, items, total_amount, order_status, payment_status, payment_method, stripe_session_id, stripe_payment_intent_id, created_at, updated_at"
      )
      .eq("stripe_session_id", sessionId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found for this session",
        },
        { status: 404 }
      );
    }

    const transformedOrder = {
      ...order,
      items: order.items || [],
    };

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      order: transformedOrder,
    });
  } catch (error) {
    logger.error("[orders/by-session/[sessionId]] request failed", {
      error: error instanceof Error ? error.message : String(error),
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
