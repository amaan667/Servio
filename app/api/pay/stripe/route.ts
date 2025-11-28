import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body = await req.json();
      const { order_id, payment_intent_id, venue_id } = body;

      if (!order_id) {
        return NextResponse.json(
          {
            success: false,
            error: "Order ID is required",
          },
          { status: 400 }
        );
      }
      
      // Verify venue_id matches authenticated context (security check)
      if (venue_id && venue_id !== context.venueId) {
        logger.warn("[PAY STRIPE] Venue ID mismatch", {
          provided: venue_id,
          authenticated: context.venueId,
          order_id,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Venue ID mismatch",
          },
          { status: 403 }
        );
      }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      env('NEXT_PUBLIC_SUPABASE_URL')!,
      env('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(_name: string, _value: string, _options: unknown) {
            /* Empty */
          },
          remove(_name: string, _options: unknown) {
            /* Empty */
          },
        },
      }
    );

    // In a real implementation, you would:
    // 1. Verify the payment intent with Stripe
    // 2. Confirm the payment was successful
    // 3. Handle unknown failed payments

    // For now, we'll simulate a successful payment
    const paymentSuccess = true; // In production, verify with Stripe API

    if (!paymentSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment failed",
        },
        { status: 400 }
      );
    }

    // Verify order belongs to authenticated venue (security check)
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("id, venue_id")
      .eq("id", order_id)
      .eq("venue_id", context.venueId)
      .single();

    if (checkError || !orderCheck) {
      logger.error("[PAY STRIPE] Order not found or venue mismatch:", {
        order_id,
        venueId: context.venueId,
        error: checkError,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Order not found or access denied",
        },
        { status: 404 }
      );
    }

    // Update order payment status to paid with stripe method
    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: "stripe",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .eq("venue_id", context.venueId) // Security: ensure venue matches
      .select()
      .single();

    if (updateError || !order) {
      logger.error("[PAY STRIPE] Failed to update order:", {
        order_id,
        venueId: context.venueId,
        error: updateError,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process payment",
          message: isDevelopment() ? updateError?.message : "Database update failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        payment_status: "PAID",
        payment_method: "stripe",
        total_amount: order.total_amount,
        payment_intent_id: payment_intent_id,
      },
    });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      // body might not be defined in catch block, so we need to handle it safely
      let orderId: string | undefined;
      try {
        const body = await req.clone().json();
        orderId = body?.order_id;
      } catch {
        // Body already consumed
      }
      
      logger.error("[PAY STRIPE] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        order_id: orderId,
        venueId: context.venueId,
      });
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            success: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      // Return generic error in production, detailed in development
      return NextResponse.json(
        {
          success: false,
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Payment processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body (required for payment routes)
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
