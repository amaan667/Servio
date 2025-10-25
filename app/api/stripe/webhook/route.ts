import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Stripe Webhook for CUSTOMER ORDER PAYMENTS
 * This is separate from /api/stripe/webhooks which handles SUBSCRIPTIONS
 */
export async function POST(req: Request) {
  const supabaseAdmin = createAdminClient();

  console.info("\n" + "=".repeat(80));
  console.info("💳 [CUSTOMER ORDER WEBHOOK] WEBHOOK RECEIVED");
  console.info("=".repeat(80));
  console.info("⏰ Timestamp:", new Date().toISOString());
  console.info("=".repeat(80) + "\n");

  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] ===== WEBHOOK RECEIVED =====");
  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] Timestamp:", new Date().toISOString());

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("❌ [CUSTOMER ORDER WEBHOOK] Missing stripe-signature header");
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Missing stripe-signature header");
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  console.info("✅ [CUSTOMER ORDER WEBHOOK] Stripe signature found");

  // Read raw text for Stripe verification
  const raw = await req.text();
  console.info("📄 [CUSTOMER ORDER WEBHOOK] Payload length:", raw.length, "bytes");

  let event: Stripe.Event;
  try {
    console.info("🔐 [CUSTOMER ORDER WEBHOOK] Verifying signature...");
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    console.info("✅ [CUSTOMER ORDER WEBHOOK] Signature verified");
    console.info("📦 [CUSTOMER ORDER WEBHOOK] Event type:", event.type);
    console.info("🆔 [CUSTOMER ORDER WEBHOOK] Event ID:", event.id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ [CUSTOMER ORDER WEBHOOK] Signature verification FAILED:", errorMessage);
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

  // Get checkout data from metadata
  const checkoutDataJson = session.metadata?.checkoutDataJson;
  console.info("📦 [CUSTOMER ORDER WEBHOOK] Has checkoutDataJson:", !!checkoutDataJson);

  if (!checkoutDataJson) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] NO CHECKOUT DATA IN METADATA!");
    console.error("=".repeat(80));
    console.error("❌ Metadata keys:", Object.keys(session.metadata || {}));
    console.error("❌ Metadata:", session.metadata);
    console.error("=".repeat(80) + "\n");
    return NextResponse.json(
      { ok: false, error: "No checkout data in session metadata" },
      { status: 400 }
    );
  }

  console.info(
    "✅ [CUSTOMER ORDER WEBHOOK] Found checkoutDataJson, length:",
    checkoutDataJson.length
  );

  let checkoutData;
  try {
    checkoutData = JSON.parse(checkoutDataJson);
    console.info("✅ [CUSTOMER ORDER WEBHOOK] Parsed checkout data successfully!");
    console.info("📋 [CUSTOMER ORDER WEBHOOK] Venue ID:", checkoutData.venueId);
    console.info("📋 [CUSTOMER ORDER WEBHOOK] Customer:", checkoutData.customerName);
    console.info("📋 [CUSTOMER ORDER WEBHOOK] Phone:", checkoutData.customerPhone);
    console.info("📋 [CUSTOMER ORDER WEBHOOK] Table:", checkoutData.tableNumber);
    console.info("📋 [CUSTOMER ORDER WEBHOOK] Cart items:", checkoutData.cart?.length);
    console.info("📋 [CUSTOMER ORDER WEBHOOK] Total:", checkoutData.total);

    if (checkoutData.cart && checkoutData.cart.length > 0) {
      console.info("🛒 [CUSTOMER ORDER WEBHOOK] Cart items breakdown:");
      checkoutData.cart.forEach(
        (item: { name: string; quantity: number; price: number; id?: string }, idx: number) => {
          console.info(
            `    ${idx + 1}. ${item.name} x${item.quantity} @ £${item.price} (ID: ${item.id || "N/A"})`
          );
        }
      );
    }
  } catch (parseError) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] JSON PARSE ERROR!");
    console.error("=".repeat(80));
    console.error("❌ Error:", parseError);
    console.error("❌ Raw JSON:", checkoutDataJson?.substring(0, 500));
    console.error("=".repeat(80) + "\n");
    return NextResponse.json(
      { ok: false, error: "Invalid checkout data in metadata" },
      { status: 400 }
    );
  }

  // Create order in database
  const orderPayload = {
    venue_id: checkoutData.venueId,
    table_number: checkoutData.tableNumber,
    table_id: null,
    counter_number: checkoutData.counterNumber || null,
    order_type: checkoutData.orderType || "table",
    order_location: checkoutData.orderLocation || checkoutData.tableNumber?.toString() || "1",
    customer_name: checkoutData.customerName,
    customer_phone: checkoutData.customerPhone,
    items: checkoutData.cart.map(
      (item: {
        id?: string;
        quantity: number;
        price: number;
        name: string;
        specialInstructions?: string;
      }) => ({
        menu_item_id: item.id || "unknown",
        quantity: item.quantity,
        price: item.price,
        item_name: item.name,
        specialInstructions: item.specialInstructions || null,
      })
    ),
    total_amount: checkoutData.total,
    notes: checkoutData.notes || "",
    order_status: "IN_PREP",
    payment_status: "PAID",
    payment_mode: "online",
    payment_method: "stripe",
    session_id: checkoutData.sessionId,
    source: checkoutData.source || "qr",
    stripe_session_id: session.id,
    stripe_payment_intent_id: String(session.payment_intent ?? ""),
  };

  console.info("💾 [CUSTOMER ORDER WEBHOOK] Creating order in database...");
  console.info("📋 [CUSTOMER ORDER WEBHOOK] Order payload:", {
    venue_id: orderPayload.venue_id,
    customer_name: orderPayload.customer_name,
    table_number: orderPayload.table_number,
    items_count: orderPayload.items.length,
    total_amount: orderPayload.total_amount,
    order_status: orderPayload.order_status,
    payment_status: orderPayload.payment_status,
  });

  const { data: createdOrder, error: createError } = await supabaseAdmin
    .from("orders")
    .insert(orderPayload)
    .select("*")
    .single();

  console.info("📊 [CUSTOMER ORDER WEBHOOK] Database insert result:");
  console.info("📊 Success:", !createError);
  console.info("📊 Order ID:", createdOrder?.id);

  if (createError) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] ORDER CREATION FAILED!");
    console.error("=".repeat(80));
    console.error("❌ Error code:", createError.code);
    console.error("❌ Error message:", createError.message);
    console.error("❌ Error details:", createError);
    console.error("=".repeat(80) + "\n");
    return NextResponse.json({ ok: false, error: createError.message }, { status: 500 });
  }

  console.info("\n" + "=".repeat(80));
  console.info("✅ [CUSTOMER ORDER WEBHOOK] ORDER CREATED SUCCESSFULLY!");
  console.info("=".repeat(80));
  console.info("🆔 Order ID:", createdOrder.id);
  console.info("📊 Order Status:", createdOrder.order_status);
  console.info("💳 Payment Status:", createdOrder.payment_status);
  console.info("👤 Customer:", createdOrder.customer_name);
  console.info("🏪 Venue ID:", createdOrder.venue_id);
  console.info("🪑 Table:", createdOrder.table_number);
  console.info("🛒 Items:", createdOrder.items?.length);
  console.info("💰 Total:", createdOrder.total_amount);
  console.info("🔗 Stripe Session:", createdOrder.stripe_session_id);
  console.info("=".repeat(80) + "\n");

  return NextResponse.json({ ok: true, orderId: createdOrder.id });
}
