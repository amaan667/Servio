import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { env, isDevelopment } from "@/lib/env";
import crypto from "crypto";

// Helper function to generate idempotency key from request
async function generateIdempotencyKey(req: NextRequest): Promise<string> {
  const body = await req.json() as Record<string, unknown>;
  const userId = (body?.user_id as string) || (body?.paid_by_user_id as string) || 'anonymous';
  const timestamp = Date.now();
  const keyData = `${userId}-${timestamp}`;

  // Create SHA-256 hash for the key
  return crypto.createHash('sha256').update(keyData).digest('hex');
}

// Helper function to generate request hash
async function generateRequestHash(req: NextRequest): Promise<string> {
  const body = await req.json() as Record<string, unknown>;
  const keyData = JSON.stringify({
    order_id: body?.order_id,
    payment_intent_id: body?.payment_intent_id,
    venue_id: body?.venue_id,
    amount: body?.total_amount,
  });

  return crypto.createHash('sha256').update(keyData).digest('hex');
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { order_id, payment_intent_id, venue_id } = body;

    // Idempotency key validation
    const idempotencyKey = req.headers.get('x-idempotency-key');
    const requestHash = generateRequestHash(req);
    
    if (idempotencyKey) {
      // Check if this exact request was already processed
      const cookieStore = await cookies();
      const supabase = createServerClient(
        env("NEXT_PUBLIC_SUPABASE_URL")!,
        env("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
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

      const { data: existingRecord } = await supabase
        .rpc('check_idempotency_key')
        .eq('idempotency_key', idempotencyKey)
        .eq('request_hash', requestHash)
        .single();

      if (existingRecord && (existingRecord as { found?: boolean; response_data?: unknown; status_code?: number }).found) {
        // Return cached response
        return NextResponse.json(
          (existingRecord as { found?: boolean; response_data?: unknown; status_code?: number }).response_data,
          {
            status: (existingRecord as { found?: boolean; response_data?: unknown; status_code?: number }).status_code
          }
        );
      }
    }

    if (!order_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    if (!venue_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Venue ID is required",
        },
        { status: 400 }
      );
    }

      const cookieStore = await cookies();
      const supabase = createServerClient(
        env("NEXT_PUBLIC_SUPABASE_URL")!,
        env("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
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
        } as { cookies: { get: (name: string) => string | undefined; set: (name: string, value: string, options?: unknown) => void; remove: (name: string, options?: unknown) => void } }
      );

    // Verify payment intent with Stripe API
    const stripe = require('stripe')(env("STRIPE_SECRET_KEY"));
    
    let paymentSuccess = false;
    let paymentError = null;

    try {
      // Verify payment intent status
      if (payment_intent_id) {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        
        paymentSuccess = paymentIntent.status === 'succeeded';
        
        if (!paymentSuccess) {
          paymentError = `Payment ${paymentIntent.status}: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`;
        }
      }
    } catch (stripeError) {
      paymentError = `Stripe verification failed: ${stripeError instanceof Error ? stripeError.message : String(stripeError)}`;
      paymentSuccess = false;
    }

    if (!paymentSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment failed",
          details: paymentError,
        },
        { status: 400 }
      );
    }

    // Verify order belongs to venue (security check)
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("id, venue_id")
      .eq("id", order_id)
      .eq("venue_id", venue_id)
      .single();

    if (checkError || !orderCheck) {
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
      .eq("venue_id", venue_id) // Security: ensure venue matches
      .select()
      .single();

    if (updateError || !order) {
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
}
