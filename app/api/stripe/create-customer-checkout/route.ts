import Stripe from "stripe";
import { env } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

const createCustomerCheckoutSchema = z.object({

/**
 * Create Stripe checkout session for customer order payment
 * This is different from subscription checkout - no tier validation needed
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    .toISOString(),
      rawBody,

    const body = await validateBody(createCustomerCheckoutSchema, rawBody);

    

    // P0 FIX: Check order status before creating session to prevent double payment
    const supabaseAdmin = createAdminClient();
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("payment_status, stripe_session_id")
      .eq("id", body.orderId)
      .single();

    if (orderError || !order) {
      
      return apiErrors.notFound("Order not found");
    }

    if (order.payment_status === "PAID") {
      
      return apiErrors.badRequest("Order is already paid");
    }

    // Initialize Stripe client inside function to avoid build-time errors
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!, {

    // P0 FIX: Reuse existing open session if available (idempotency)
    if (order.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        if (existingSession.status === "open") {
          
          return success({

        }
      } catch (e) {
        // Ignore error (session might be expired/invalid/deleted), create new one

      }
    }

    

    // Create Stripe checkout session for order payment
    // Store ONLY order ID in metadata (avoids 500 char limit)
    const session = await stripe.checkout.sessions.create({

              name: `Order at ${body.venueName || "Restaurant"}`,

            },
            unit_amount: Math.round(body.amount * 100), // Convert to pence
          },

        },
      ],

      success_url: `${env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/payment/cancel`,

      },

    // Update the order with the session ID so the webhook can find it
    // This is important for webhook reliability
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({

        // Mark as PAY_NOW explicitly to track intent

      .eq("id", body.orderId);

    if (updateError) {
      :", {

      // Don't fail the request - webhook can still find order by orderId in metadata
    } else {
      
    }

    return success({

  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Failed to create checkout session", error);
  }
}
