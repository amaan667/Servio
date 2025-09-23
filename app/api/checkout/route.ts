import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function POST(req: Request) {
  try {
    const { 
      orderId, 
      total, 
      currency = "GBP", 
      items = [],
      venueId,
      tableNumber,
      customerName,
      customerPhone,
      source
    } = await req.json();
    
    if (!orderId || typeof total !== "number") {
      return NextResponse.json({ error: "orderId and total are required" }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_APP_URL; // MUST match the domain customers use
    if (!base) throw new Error("NEXT_PUBLIC_APP_URL not set");

    const session = await stripe.checkout.sessions.create({
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
        items: JSON.stringify(items),
        source: source || 'qr'
      },
      success_url: `${base}/checkout/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}&venueId=${venueId || 'default-venue'}&tableNumber=${tableNumber || '1'}`,
      cancel_url: `${base}/checkout/cancel?orderId=${orderId}&venueId=${venueId || 'default-venue'}&tableNumber=${tableNumber || '1'}`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id }, { status: 200 });
  } catch (e: any) {
    console.error("Stripe session error:", e);
    return NextResponse.json({ error: e.message ?? "Stripe error" }, { status: 500 });
  }
}
