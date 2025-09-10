import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { createServerClient } from '@supabase/ssr';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function POST(req: Request) {
  const buf = await req.text();
  const sig = headers().get("stripe-signature")!;
  try {
    const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = (session.metadata?.orderId as string) || "";
      if (orderId) {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            cookies: {
              get(name: string) { return undefined; },
              set(name: string, value: string, options: any) { },
              remove(name: string, options: any) { },
            },
          }
        );
        
        await supabase.from("orders")
          .update({ 
            status: "paid", 
            payment_status: "paid", 
            paid_at: new Date().toISOString() 
          })
          .eq("id", orderId);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// Disable Next's body parser for this route
export const runtime = 'nodejs';
