
import Stripe from "stripe";
import { env } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

const createCustomerCheckoutSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  customerEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val)),
  customerName: z.string().min(1).max(100).optional(),
  venueName: z.string().min(1).max(100).optional(),
  orderId: z.string().uuid("Invalid order ID"),
});

/**
 * Create Stripe checkout session for customer order payment
 * This is different from subscription checkout - no tier validation needed
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.json();

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
      apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
    });

    // P0 FIX: Reuse existing open session if available (idempotency)
    if (order.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        if (existingSession.status === "open") {

          return success({
            sessionId: existingSession.id,
            url: existingSession.url,
          });
        }
      } catch (e) {
        // Ignore error (session might be expired/invalid/deleted), create new one

      }
    }

    // Create Stripe checkout session for order payment
    // Store ONLY order ID in metadata (avoids 500 char limit)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Order at ${body.venueName || "Restaurant"}`,
              description: body.customerName || "Customer order",
            },
            unit_amount: Math.round(body.amount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/payment/cancel`,
      metadata: {
        orderId: body.orderId,
        paymentType: "order_payment",
      },
      customer_email: body.customerEmail || undefined,
    });

    // Update the order with the session ID so the webhook can find it
    // This is important for webhook reliability
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        stripe_session_id: session.id,
        // Mark as PAY_NOW explicitly to track intent
        payment_method: "PAY_NOW",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.orderId);

    if (updateError) {

      // Don't fail the request - webhook can still find order by orderId in metadata
    } else { /* Else case handled */ }

    return success({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Failed to create checkout session", error);
  }
}
