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

        },
        { status: 404 }
      );
    }

    // Idempotency: if already paid, just return it.
    if ((order.payment_status || "").toUpperCase() === "PAID") {
      return NextResponse.json({
        order,

    }

    // Update payment status to PAID (fallback when webhook is delayed/missed)
    const nowIso = new Date().toISOString();
    const existingPaymentMethod = String(order.payment_method || "").toUpperCase();
    const safePaymentMethod = ["PAY_NOW", "PAY_LATER", "PAY_AT_TILL"].includes(
      existingPaymentMethod
    )
      ? existingPaymentMethod

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({

        // Preserve original payment_method (PAY_LATER stays PAY_LATER).

      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      
      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }

    return NextResponse.json({

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
