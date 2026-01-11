import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase";
import { isDevelopment } from "@/lib/env";

export const runtime = "nodejs";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {

            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const { searchParams } = new URL(req.url);
      const orderId = searchParams.get("orderId")!;
      const sessionId = searchParams.get("sessionId")!;

      // STEP 4: Validate inputs
      if (!orderId || !sessionId) {
        return NextResponse.json(
          { error: "Missing required parameters: orderId and sessionId" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify Stripe session and payment status
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const paid = session.payment_status === "paid";

      if (paid) {
        // STEP 6: Use admin client for order lookup with venue filtering
        const admin = createAdminClient();

        // Find the order by session ID and venue ID (security: filter by venue)
        let order: Record<string, unknown> | null = null;
        const { data: initialOrder } = await admin
          .from("orders")
          .select("id, venue_id, stripe_session_id, payment_status")
          .eq("stripe_session_id", sessionId)
          .eq("venue_id", venueId) // CRITICAL: Always filter by venueId
          .maybeSingle();

        order = initialOrder;

        // If not found by session ID, wait for webhook to create order
        if (!order) {
          // Wait a bit for the webhook to create the order, then try again with retry logic
          let retryCount = 0;
          const maxRetries = 5;
          let orderFound = false;

          while (retryCount < maxRetries && !orderFound) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const { data: retryOrder, error: retryError } = await admin
              .from("orders")
              .select("id, venue_id, stripe_session_id, payment_status")
              .eq("stripe_session_id", sessionId)
              .eq("venue_id", venueId) // CRITICAL: Always filter by venueId
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
            
            return NextResponse.json(
              { paid: false, error: "Order not found or access denied - webhook may be delayed" },
              { status: 404 }
            );
          }
        }

        if (!order) {
          
          return NextResponse.json(
            { paid: false, error: "Order not found or access denied" },
            { status: 404 }
          );
        }

        // STEP 7: Return success response
        return NextResponse.json({ paid: true, orderId: order.id }, { status: 200 });
      }

      return NextResponse.json({ paid: false }, { status: 200 });
    } catch (_error) {
      // STEP 8: Consistent error handling
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {

          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {

          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // STEP 9: Extract venueId from request (query, body, or resource lookup)

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get("sessionId");

        if (!sessionId) {
          return null;
        }

        // Look up the order by session ID to get venue_id
        const admin = createAdminClient();
        const { data: order } = await admin
          .from("orders")
          .select("venue_id")
          .eq("stripe_session_id", sessionId)
          .single();

        if (order?.venue_id) {
          return order.venue_id;
        }

        return null;
      } catch {
        return null;
      }
    },
  }
);
