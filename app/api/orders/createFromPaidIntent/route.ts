import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { createServerSupabase } from "@/lib/supabase";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";
import { generateIdempotencyKey, withIdempotency, checkIdempotency } from "@/lib/db/idempotency";
import { verifyVenueExists } from "@/lib/middleware/authorization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";
import type StripeNamespace from "stripe";

interface CreateOrderRequest {

}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);

  // CRITICAL: Rate limiting on public payment route to prevent spam/abuse
  const rateLimitResult = await rateLimit(req, RATE_LIMITS.STRICT);
  if (!rateLimitResult.success) {
    
    return NextResponse.json(
      {

        message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
      },
      {

          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        },
      }
    );
  }

  try {
    // Use authenticated client - this is a public route but we still want RLS for safety
    // Note: For public routes creating orders, we may need admin client but with explicit venue verification
    const supabase = await createServerSupabase();

    const body: CreateOrderRequest = await req.json();
    const { paymentIntentId, cartId } = body;

    if (!paymentIntentId || !cartId) {
      return NextResponse.json(
        { ok: false, message: "Missing payment intent ID or cart ID" },
        { status: 400 }
      );
    }

    // Handle demo mode
    if (paymentIntentId.startsWith("demo-")) {
      return await createDemoOrder(cartId);
    }

    // Idempotency check
    const idempotencyKey =
      req.headers.get("idempotency-key") ||
      generateIdempotencyKey("/api/orders/createFromPaidIntent", paymentIntentId, {
        paymentIntentId,
        cartId,

    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ paymentIntentId, cartId }))
      .digest("hex");

    const existing = await checkIdempotency(idempotencyKey);
    if (existing.exists) {
       + "...",
        correlationId,

      return NextResponse.json(existing.response.response_data, {

    }

    // Retrieve payment intent from Stripe
    const { stripe } = await import("@/lib/stripe-client");
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify payment succeeded
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        {

          message: `Payment not completed. Status: ${paymentIntent.status}`,
        },
        { status: 400 }
      );
    }

    // Check for existing order (additional idempotency check at DB level)
    // Use explicit field selection instead of select("*")
    const { data: existingOrder } = await supabase
      .from("orders")
      .select(
        "id, venue_id, table_number, customer_name, customer_phone, customer_email, total_amount, order_status, payment_status, payment_intent_id, created_at, updated_at, items"
      )
      .eq("payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingOrder) {
      

      // Store in idempotency cache
      await import("@/lib/db/idempotency").then(({ storeIdempotency }) => {
        storeIdempotency(
          idempotencyKey,
          requestHash,
          { ok: true, order: existingOrder, message: "Order already exists" },
          200,
          3600
        ).catch(() => {
          // Non-critical

      return NextResponse.json({

    }

    // Extract order data from payment intent metadata
    const { venue_id, table_number, customer_name, customer_phone, items_summary } =
      paymentIntent.metadata;

    if (!venue_id || !table_number || !customer_name) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    // Verify venue exists and is valid (prevents cross-venue access)
    // NOTE: This is a public customer route, so we verify venue without requiring authentication
    const venueCheck = await verifyVenueExists(venue_id);

    if (!venueCheck.valid) {
      
      return NextResponse.json(
        {

        },
        { status: 404 }
      );
    }

    // Create order structure with items from payment intent metadata
    const orderAmount = paymentIntent.amount_received || paymentIntent.amount;
    type PaymentIntentWithCharges = StripeNamespace.PaymentIntent & {
      charges?: StripeNamespace.ApiList<StripeNamespace.Charge>;
    };
    const paymentIntentWithCharges = paymentIntent as PaymentIntentWithCharges;
    const billingEmail =
      paymentIntentWithCharges.charges?.data?.[0]?.billing_details?.email ?? null;

    const orderData = {

      venue_id,

      customer_name,

      order_status: "PLACED", // Start as PLACED to show "waiting on kitchen"

      payment_method: "PAY_NOW", // Standardized payment method for Stripe payments
      payment_mode: "online", // Required for payment_method consistency constraint

          item_name: items_summary || `Order for ${customer_name}`,

        },
      ],
      notes: `Order created from payment intent ${paymentIntentId}. Items: ${items_summary || "N/A"}`,

    };

    // Use idempotency wrapper for order creation
    const result = await withIdempotency(
      idempotencyKey,
      requestHash,
      async () => {
        // Use OrderService for transactional order creation
        const { orderService } = await import("@/lib/services/OrderService");

        // Convert orderData to OrderService format
        const serviceOrderData = {

          })),

        };

        // Use admin client for public route (customer payment flow)
        const order = await orderService.createOrder(venue_id, serviceOrderData);

        if (!order) {
          
          throw new Error("Failed to create order: OrderService returned null");
        }

        // Publish realtime event for live orders
        try {
          const { createAdminClient } = await import("@/lib/supabase");
          const adminClient = createAdminClient();
          await adminClient.channel("orders").send({

              },

            },

        } catch (realtimeError) {

            correlationId,

          // Don't fail the order creation if realtime fails
        }

        return {

            },
          },

        };
      },
      3600 // 1 hour TTL
    );

    

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (_error) {
    const correlationId = getCorrelationIdFromRequest(req);

    

    if (_error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {

          message: `Stripe error: ${_error.message}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}

async function createDemoOrder(cartId: string) {
  try {
    // Demo orders use admin client - this is acceptable for demo/test scenarios
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Create a demo order
    const demoOrderData = {

      total_amount: 2800, // £28.00 in pence

      payment_intent_id: `demo-${cartId}`,
      payment_method: "PAY_NOW", // Demo orders use PAY_NOW method
      payment_mode: "online", // Required for payment_method consistency constraint

        },
        {

        },
      ],
      notes: `Demo order created from cart ${cartId}`,

    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(demoOrderData)
      .select()
      .single();

    if (orderError) {
      
      return NextResponse.json(
        {

          message: `Failed to create demo order: ${orderError.message}`,
        },
        { status: 500 }
      );
    }

    // Publish realtime event for live orders
    try {
      await supabase.channel("orders").send({

          },

        },

    } catch (realtimeError) {
      
      // Don't fail the order creation if realtime fails
    }

    return NextResponse.json({

      },

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
