import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId")!;
    const sessionId = searchParams.get("sessionId")!;
    if (!orderId || !sessionId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    console.log('[VERIFY] Checking payment for orderId:', orderId, 'sessionId:', sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('[VERIFY] Stripe session status:', session.payment_status);
    const paid = session.payment_status === "paid";

    if (paid) {
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
      
      // Find the order by session ID first
      let { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_session_id", sessionId)
        .single();

      // If not found by session ID, the order might not be created yet (webhook might be delayed)
      if (orderError) {
        console.log("Order not found by session ID, waiting for webhook to create order...");
        
        // Wait a bit for the webhook to create the order, then try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to find by session ID again
        const { data: retryOrder, error: retryError } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_session_id", sessionId)
          .single();

        if (retryOrder && !retryError) {
          console.log("Found order on retry:", retryOrder.id);
          order = retryOrder;
          orderError = null;
        } else {
          console.error("Order still not found after retry for session:", sessionId);
          return NextResponse.json({ paid: false, error: "Order not found - webhook may be delayed" }, { status: 404 });
        }
      }

      if (!order) {
        console.error("Order is null after all attempts to find it");
        return NextResponse.json({ paid: false, error: "Order not found" }, { status: 404 });
      }

      return NextResponse.json({ paid: true, orderId: order.id }, { status: 200 });
    }

    return NextResponse.json({ paid: false }, { status: 200 });
  } catch (e: any) {
    console.error("verify error:", e);
    return NextResponse.json({ error: e.message ?? "verify failed" }, { status: 500 });
  }
}
