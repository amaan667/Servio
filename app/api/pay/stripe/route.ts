import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { processStripePaymentSchema } from "@/lib/api/validation-schemas";
import { env, isDevelopment } from "@/lib/env";

export const runtime = "nodejs";

// Process Stripe payment with idempotency enforcement
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { order_id, payment_intent_id, venue_id } = context.body as {
      order_id: string;
      payment_intent_id?: string;
      venue_id: string;
    };

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
      throw new Error(paymentError || "Payment failed");
    }

    // Get Supabase client
    const supabase = await createServerSupabase();

    // Verify order belongs to venue (security check)
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("id, venue_id")
      .eq("id", order_id)
      .eq("venue_id", venue_id)
      .single();

    if (checkError || !orderCheck) {
      throw new Error("Order not found or access denied");
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
      throw new Error(isDevelopment() ? updateError?.message || "Database update failed" : "Failed to process payment");
    }

    return {
      success: true,
      data: {
        order_id: order.id,
        payment_status: "PAID",
        payment_method: "stripe",
        total_amount: order.total_amount,
        payment_intent_id: payment_intent_id,
      },
    };
  },
  {
    schema: processStripePaymentSchema,
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "body",
    enforceIdempotency: true, // Critical for payment operations to prevent double-charging
    rateLimit: {
      window: 60, // 60 seconds (1 minute)
      limit: 10, // 10 requests per minute
    },
  }
);
