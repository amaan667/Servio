import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger, logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    
    const { 
      orderId, 
      total, 
      currency = "GBP", 
      items = [],
      venueId,
      tableNumber,
      customerName,
      customerPhone,
      customerEmail,
      source
    } = await req.json();
    
    if (!orderId || typeof total !== "number") {
      return NextResponse.json({ error: "orderId and total are required" }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_APP_URL; // MUST match the domain customers use
    if (!base) throw new Error("NEXT_PUBLIC_APP_URL not set");

    // Build session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Order #${orderId}` },
            unit_amount: Math.round(total * 100), // Convert to minor units (pence)
          },
          quantity: 1,
        },
      ],
      metadata: { 
        orderId,
        venueId: venueId || 'default-venue',
        tableNumber: tableNumber?.toString() || '1',
        customerName: customerName || 'Customer',
        customerPhone: customerPhone || '+1234567890',
        source: source || 'qr',
        // Truncate items to stay within 500 char limit, keeping only essential info
        items: JSON.stringify(items.map((item: unknown) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))).substring(0, 200) // Limit to 200 chars to leave room for other metadata
      },
      success_url: `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
      cancel_url: `${base}/payment/cancel?orderId=${orderId}&venueId=${venueId || 'default-venue'}&tableNumber=${tableNumber || '1'}`,
    };

    // Add customer email if provided - Stripe will automatically send digital receipts
    if (customerEmail && customerEmail.trim() !== '') {
      sessionParams.customer_email = customerEmail.trim();
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // CRITICAL FIX: Store the stripe_session_id immediately on the order
    // This prevents race condition where user reaches success page before webhook fires
    logger.debug('[CHECKOUT DEBUG] Updating order with stripe_session_id', { sessionId: session.id });
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        stripe_session_id: session.id,
        payment_method: 'stripe',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      logger.error('[CHECKOUT DEBUG] Failed to update order with session ID', { error: updateError });
      // Don't fail the checkout, webhook will handle it as fallback
    } else {
      logger.debug('[CHECKOUT DEBUG] Successfully stored stripe_session_id on order', { orderId });
    }

    return NextResponse.json({ url: session.url, sessionId: session.id }, { status: 200 });
  } catch (e: unknown) {
    logger.error("Stripe session error", { error: e instanceof Error ? e.message : 'Unknown error' });
    return NextResponse.json({ error: e.message ?? "Stripe error" }, { status: 500 });
  }
}
