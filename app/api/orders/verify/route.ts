import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";

import { apiErrors } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return apiErrors.badRequest("Session ID is required");
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        {
          error: "Payment not completed",
        },
        { status: 400 }
      );
    }

    // Get metadata from session
    const metadata =
      session.metadata ||
      {
        /* Empty */
      };
    const orderId = metadata.orderId;

    if (!orderId) {
      return NextResponse.json(
        {
          error: "No order ID in session metadata",
        },
        { status: 400 }
      );
    }

    // Use admin client to avoid RLS issues; the Stripe session metadata is the security boundary.
    const supabaseAdmin = createAdminClient();

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, venue_id, payment_status, stripe_session_id, payment_method")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        {
          error: "Order not found. The order may not have been created properly.",
          details: fetchError?.message,
        },
        { status: 404 }
      );
    }

    // Idempotency: if already paid, just return it.
    if ((order.payment_status || "").toUpperCase() === "PAID") {
      return NextResponse.json({
        order,
        updated: false,
      });
    }

    // Update payment status to PAID (fallback when webhook is delayed/missed)
    const nowIso = new Date().toISOString();
    const existingPaymentMethod = String(order.payment_method || "").toUpperCase();
    const safePaymentMethod = ["PAY_NOW", "PAY_LATER", "PAY_AT_TILL"].includes(
      existingPaymentMethod
    )
      ? existingPaymentMethod
      : "PAY_NOW";
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "PAID",
        // Preserve original payment_method (PAY_LATER stays PAY_LATER).
        payment_method: safePaymentMethod,
        stripe_session_id: order.stripe_session_id || session.id,
        stripe_payment_intent_id: String(session.payment_intent ?? ""),
        updated_at: nowIso,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update order payment status",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order: updatedOrder,
      updated: true,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}
