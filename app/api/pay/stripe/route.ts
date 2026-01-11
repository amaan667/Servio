import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { env, isDevelopment } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {

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

        },
        { status: 400 }
      );
    }

    if (!venue_id) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      env("NEXT_PUBLIC_SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
      {

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

        },
        { status: 404 }
      );
    }

    // Update order payment status to paid with stripe method
    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update({

      .eq("id", order_id)
      .eq("venue_id", venue_id) // Security: ensure venue matches
      .select()
      .single();

    if (updateError || !order) {
      
      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }

    return NextResponse.json({

      },

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

        },
        { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
      );
    }

    // Return generic error in production, detailed in development
    return NextResponse.json(
      {

        ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}
