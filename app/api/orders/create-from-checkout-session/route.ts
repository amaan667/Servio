import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors } from "@/lib/api/standard-response";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

export const runtime = "nodejs";

/**
 * POST: Create order from Stripe Checkout Session (Pay Now flow).
 * Order is created ONLY after payment has succeeded (session.payment_status === "paid").
 * Public: no auth. Called from payment success page when session has no orderId in metadata.
 */
export async function POST(req: NextRequest) {
  const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMIT", message: "Too many requests" } },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const sessionId = body.session_id as string | undefined;

    if (!sessionId) {
      return apiErrors.badRequest("session_id is required");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Pay Now: never create an order until payment has succeeded
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Payment not completed" } },
        { status: 400 }
      );
    }

    const meta = (session.metadata || {}) as Record<string, string>;

    if (meta.orderId) {
      const supabase = createAdminClient();
      const { data: existing } = await supabase
        .from("orders")
        .select("id, venue_id, order_number, total_amount, payment_status")
        .eq("id", meta.orderId)
        .eq("venue_id", meta.venueId)
        .single();

      if (existing) {
        return NextResponse.json({
          success: true,
          data: { order: existing },
        });
      }
    }

    const venueId = meta.venueId;
    const tableNumber = meta.tableNumber ? parseInt(meta.tableNumber, 10) : null;
    const customerName = meta.customerName || "Customer";
    const customerPhone = meta.customerPhone || "";
    const amount = parseFloat(meta.amount || "0");

    if (!venueId || amount <= 0) {
      return apiErrors.badRequest("Invalid session metadata: venueId and amount required");
    }

    let items: Array<{
      menu_item_id: string | null;
      item_name: string;
      quantity: number;
      price: number;
      special_instructions?: string | null;
    }> = [];
    try {
      const raw = meta.items ? JSON.parse(meta.items) : [];
      items = Array.isArray(raw)
        ? raw.map(
            (item: {
              menu_item_id?: string;
              id?: string;
              name?: string;
              item_name?: string;
              quantity?: number;
              price?: number;
              special_instructions?: string;
            }) => ({
              menu_item_id: item.menu_item_id || item.id || null,
              item_name: item.item_name || item.name || "Item",
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              special_instructions: item.special_instructions ?? null,
            })
          )
        : [];
    } catch {
      // ignore parse error
    }

    if (items.length === 0) {
      items = [
        {
          menu_item_id: null,
          item_name: "Order",
          quantity: 1,
          price: amount,
          special_instructions: null,
        },
      ];
    }

    const supabase = createAdminClient();

    const { data: insertedRows, error } = await supabase
      .from("orders")
      .insert({
        venue_id: venueId,
        table_number: tableNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: session.customer_email || null,
        items,
        total_amount: amount,
        order_status: "PLACED",
        payment_status: "PAID",
        payment_method: "PAY_NOW",
        payment_mode: "online",
        source: meta.source || "qr",
        fulfillment_type: "table",
        qr_type: meta.qr_type || null,
        requires_collection: false,
        stripe_session_id: session.id,
        stripe_payment_intent_id: String(session.payment_intent || ""),
      })
      .select("*");

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL", message: error.message } },
        { status: 500 }
      );
    }

    const order = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL", message: "Order not returned" } },
        { status: 500 }
      );
    }

    try {
      await createKDSTicketsWithAI(supabase, {
        id: order.id,
        venue_id: order.venue_id,
        items: order.items || [],
        customer_name: order.customer_name,
        table_number: order.table_number,
        table_id: order.table_id,
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      data: { order },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message } },
      { status: 500 }
    );
  }
}
