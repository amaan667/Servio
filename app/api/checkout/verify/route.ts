import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from '@supabase/ssr';
import { logInfo, logError } from "@/lib/logger";

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId")!;
    const sessionId = searchParams.get("sessionId")!;
    if (!orderId || !sessionId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    logInfo(`'[VERIFY] Checking payment' { orderId sessionId }`);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logInfo('[VERIFY] Stripe session status:', session.payment_status);
    const paid = session.payment_status === "paid";

    if (paid) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(_name: string) { return undefined; },
            set(_name: string, _value: string, _options: any) { },
            remove(_name: string, _options: any) { },
          },
        }
      );
      
      // Find the order by session ID
      logInfo("[VERIFY] Looking for order with session ID", { sessionId });
      let { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, stripe_session_id, payment_status")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      // If not found by session ID, wait for webhook to create order
      if (orderError) {
        logInfo("Error finding order by session ID", { error: orderError });
        return NextResponse.json({ paid: false, error: "Database error" }, { status: 500 });
      }

      if (!order) {
        logInfo("Order not found by session ID, waiting for webhook to create order...");
        
        // Wait a bit for the webhook to create the order, then try again with retry logic
        let retryCount = 0;
        const maxRetries = 5;
        let orderFound = false;
        
        while (retryCount < maxRetries && !orderFound) {
          logInfo(`[VERIFY] Retry attempt ${retryCount + 1}/${maxRetries} for session`, { sessionId });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: retryOrder, error: retryError } = await supabase
            .from("orders")
            .select("id, stripe_session_id, payment_status")
            .eq("stripe_session_id", sessionId)
            .maybeSingle();

          if (retryError) {
            logInfo(`[VERIFY] Retry ${retryCount + 1} failed with error`, { error: retryError.message });
            retryCount++;
          } else if (retryOrder) {
            logInfo("Found order on retry", { orderId: retryOrder.id });
            order = retryOrder;
            orderFound = true;
          } else {
            logInfo(`[VERIFY] Retry ${retryCount + 1} failed: No order found`);
            retryCount++;
          }
        }

        if (!orderFound) {
          logError("Order still not found after retry for session", { sessionId });
          return NextResponse.json({ paid: false, error: "Order not found - webhook may be delayed" }, { status: 404 });
        }
      }

      if (!order) {
        logError("Order is null after all attempts to find it");
        return NextResponse.json({ paid: false, error: "Order not found" }, { status: 404 });
      }

      return NextResponse.json({ paid: true, orderId: order.id }, { status: 200 });
    }

    return NextResponse.json({ paid: false }, { status: 200 });
  } catch (e: any) {
    logError("verify error", { error: e });
    return NextResponse.json({ error: e.message ?? "verify failed" }, { status: 500 });
  }
}