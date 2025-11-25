import { NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { stripe } from "@/lib/stripe-client";
import { logger } from '@/lib/logger';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI(req);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
    const rateLimitResult = await rateLimit(req as unknown as NextRequest, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId")!;
    const sessionId = searchParams.get("sessionId")!;
    if (!orderId || !sessionId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";

    if (paid) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get() { return undefined; },
            set() { /* Empty */ },
            remove() { /* Empty */ },
          },
        }
      );
      
      // Find the order by session ID
      let order: Record<string, unknown> | null = null;
      const { data: initialOrder } = await supabase
        .from("orders")
        .select("id, stripe_session_id, payment_status")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      order = initialOrder;

      // If not found by session ID, wait for webhook to create order
      if (!order) {
        
        // Wait a bit for the webhook to create the order, then try again with retry logic
        let retryCount = 0;
        const maxRetries = 5;
        let orderFound = false;
        
        while (retryCount < maxRetries && !orderFound) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: retryOrder, error: retryError } = await supabase
            .from("orders")
            .select("id, stripe_session_id, payment_status")
            .eq("stripe_session_id", sessionId)
            .maybeSingle();

          if (retryError) {
            retryCount++;
          } else if (retryOrder) {
            order = retryOrder;
            orderFound = true;
          } else {
            retryCount++;
          }
        }

        if (!orderFound) {
          logger.error("Order still not found after retry for session", { sessionId });
          return NextResponse.json({ paid: false, error: "Order not found - webhook may be delayed" }, { status: 404 });
        }
      }

      if (!order) {
        logger.error("Order is null after all attempts to find it");
        return NextResponse.json({ paid: false, error: "Order not found" }, { status: 404 });
      }

      return NextResponse.json({ paid: true, orderId: order.id }, { status: 200 });
    }

    return NextResponse.json({ paid: false }, { status: 200 });
  } catch (_e) {
    logger.error("verify error", { error: _e instanceof Error ? _e.message : 'Unknown error' });
    return NextResponse.json({ error: _e instanceof Error ? _e.message : "verify failed" }, { status: 500 });
  }
}
