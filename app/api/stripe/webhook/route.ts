import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Customer orders webhook uses its OWN signing secret from Stripe Dashboard
// Get this from: Stripe Dashboard → Webhooks → "Servio" endpoint → Signing secret
const webhookSecret = process.env.STRIPE_CUSTOMER_WEBHOOK_SECRET!;

/**
 * Stripe Webhook for CUSTOMER ORDER PAYMENTS
 * This is separate from /api/stripe/webhooks which handles SUBSCRIPTIONS
 */
export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  console.info("\n" + "=".repeat(80));
  console.info("💳 [CUSTOMER ORDER WEBHOOK] WEBHOOK RECEIVED");
  console.info("=".repeat(80));
  console.info("⏰ Timestamp:", new Date().toISOString());
  console.info("=".repeat(80) + "\n");

  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] ===== WEBHOOK RECEIVED =====");
  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] Timestamp:", new Date().toISOString());

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("❌ [CUSTOMER ORDER WEBHOOK] Missing stripe-signature header");
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Missing stripe-signature header");
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  console.info("✅ [CUSTOMER ORDER WEBHOOK] Stripe signature found");

  // IMPORTANT: Read raw body - exact same as subscriptions webhook
  const body = await request.text();
  console.info("📄 [CUSTOMER ORDER WEBHOOK] Payload length:", body.length, "bytes");

  let event: Stripe.Event;
  try {
    console.info("🔐 [CUSTOMER ORDER WEBHOOK] Verifying signature...");

    // Use EXACT same method as subscriptions webhook (no trimming!)
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.info("✅ [CUSTOMER ORDER WEBHOOK] Signature verified");
    console.info("📦 [CUSTOMER ORDER WEBHOOK] Event type:", event.type);
    console.info("🆔 [CUSTOMER ORDER WEBHOOK] Event ID:", event.id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] SIGNATURE VERIFICATION FAILED!");
    console.error("=".repeat(80));
    console.error("❌ Error:", errorMessage);
    console.error("=".repeat(80) + "\n");

    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Webhook construction error:", errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    console.info("ℹ️  [CUSTOMER ORDER WEBHOOK] Ignoring event type:", event.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  console.info("\n" + "=".repeat(80));
  console.info("🎯 [CUSTOMER ORDER WEBHOOK] CHECKOUT SESSION COMPLETED");
  console.info("=".repeat(80));
  console.info("🆔 Session ID:", session.id);
  console.info("💰 Amount:", session.amount_total, session.currency);
  console.info("👤 Customer:", session.customer_details?.email, session.customer_details?.name);
  console.info("📦 Metadata:", JSON.stringify(session.metadata, null, 2));
  console.info("=".repeat(80) + "\n");

  // Check if already processed (idempotency)
  console.info("🔍 [CUSTOMER ORDER WEBHOOK] Checking for duplicate processing...");
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, stripe_session_id, payment_status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    console.info("✅ [CUSTOMER ORDER WEBHOOK] Session already processed:", existing.id);
    return NextResponse.json({ ok: true, already: true, orderId: existing.id });
  }
  console.info("✅ [CUSTOMER ORDER WEBHOOK] No duplicate found, proceeding...");

  // Get order ID from metadata (order was created BEFORE Stripe checkout)
  const orderId = session.metadata?.orderId;
  console.info("🔍 [CUSTOMER ORDER WEBHOOK] Order ID from metadata:", orderId);

  if (!orderId) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] NO ORDER ID IN METADATA!");
    console.error("=".repeat(80));
    console.error("❌ Metadata keys:", Object.keys(session.metadata || {}));
    console.error("❌ Metadata:", session.metadata);
    console.error("=".repeat(80) + "\n");
    return NextResponse.json(
      { ok: false, error: "No orderId in session metadata" },
      { status: 400 }
    );
  }

  // Update existing order with payment info
  console.info("💾 [CUSTOMER ORDER WEBHOOK] Updating order with payment info...");

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "PAID",
      payment_method: "stripe",
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] ORDER UPDATE FAILED!");
    console.error("=".repeat(80));
    console.error("❌ Error code:", updateError.code);
    console.error("❌ Error message:", updateError.message);
    console.error("❌ Error details:", updateError);
    console.error("=".repeat(80) + "\n");
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  console.info("\n" + "=".repeat(80));
  console.info("✅ [CUSTOMER ORDER WEBHOOK] ORDER UPDATED SUCCESSFULLY!");
  console.info("=".repeat(80));
  console.info("🆔 Order ID:", updatedOrder.id);
  console.info("📊 Order Status:", updatedOrder.order_status);
  console.info("💳 Payment Status:", updatedOrder.payment_status);
  console.info("👤 Customer:", updatedOrder.customer_name);
  console.info("🏪 Venue ID:", updatedOrder.venue_id);
  console.info("🪑 Table:", updatedOrder.table_number);
  console.info("🛒 Items:", updatedOrder.items?.length);
  console.info("💰 Total:", updatedOrder.total_amount);
  console.info("🔗 Stripe Session:", updatedOrder.stripe_session_id);
  console.info("=".repeat(80) + "\n");

  return NextResponse.json({ ok: true, orderId: updatedOrder.id });
}
