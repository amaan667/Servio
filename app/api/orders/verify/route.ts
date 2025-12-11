import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

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
    logger.debug("[VERIFY] Stripe session retrieved:", {
      id: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });

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

    // Fetch the existing order (should have been created in order page)

    const supabase = await createClient();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      logger.error("[VERIFY] Failed to fetch order:", { value: fetchError });
      return NextResponse.json(
        {
          error: "Order not found. The order may not have been created properly.",
          details: fetchError?.message,
        },
        { status: 404 }
      );
    }

    // Update payment status to PAID

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: "stripe",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      logger.error("[VERIFY] Failed to update payment status:", { value: updateError });
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
    logger.error("[VERIFY] Error:", {
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
