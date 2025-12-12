import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";
import { generateIdempotencyKey, withIdempotency, checkIdempotency } from "@/lib/db/idempotency";
import { verifyVenueExists } from "@/lib/middleware/authorization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";
import type StripeNamespace from "stripe";

interface CreateOrderRequest {
  paymentIntentId: string;
  cartId: string;
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);

  // CRITICAL: Rate limiting on public payment route to prevent spam/abuse
  const rateLimitResult = await rateLimit(req, RATE_LIMITS.STRICT);
  if (!rateLimitResult.success) {
    logger.warn("[ORDER FROM INTENT] Rate limit exceeded", {
      correlationId,
      reset: rateLimitResult.reset,
    });
    return NextResponse.json(
      {
        ok: false,
        message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
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
      });

    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ paymentIntentId, cartId }))
      .digest("hex");

    const existing = await checkIdempotency(idempotencyKey);
    if (existing.exists) {
      logger.info("[ORDER FROM INTENT] Idempotent request - returning cached", {
        paymentIntentId,
        idempotencyKey: idempotencyKey.substring(0, 20) + "...",
        correlationId,
      });
      return NextResponse.json(existing.response.response_data, {
        status: existing.response.status_code,
      });
    }

    // Retrieve payment intent from Stripe
    const { stripe } = await import("@/lib/stripe-client");
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify payment succeeded
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        {
          ok: false,
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
      logger.info("[ORDER FROM INTENT] Order already exists", {
        orderId: existingOrder.id,
        paymentIntentId,
        correlationId,
      });

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
        });
      });

      return NextResponse.json({
        ok: true,
        order: existingOrder,
        message: "Order already exists",
      });
    }

    // Extract order data from payment intent metadata
    const { venue_id, table_number, customer_name, customer_phone, items_summary } =
      paymentIntent.metadata;

    if (!venue_id || !table_number || !customer_name) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing order data in payment intent metadata",
        },
        { status: 400 }
      );
    }

    // Verify venue exists and is valid (prevents cross-venue access)
    // NOTE: This is a public customer route, so we verify venue without requiring authentication
    const venueCheck = await verifyVenueExists(venue_id);

    if (!venueCheck.valid) {
      logger.error("[ORDER FROM INTENT] Venue verification failed", {
        venue_id,
        paymentIntentId,
        correlationId,
        error: venueCheck.error,
      });
      return NextResponse.json(
        {
          ok: false,
          message: venueCheck.error || "Venue not found",
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
      id: uuidv4(),
      venue_id,
      table_number: parseInt(table_number),
      customer_name,
      customer_phone: customer_phone || null,
      customer_email: billingEmail,
      total_amount: orderAmount,
      order_status: "PLACED", // Start as PLACED to show "waiting on kitchen"
      payment_status: "PAID",
      payment_intent_id: paymentIntentId,
      payment_method: "PAY_NOW", // Standardized payment method for Stripe payments
      payment_mode: "online", // Required for payment_method consistency constraint
      items: [
        // Create a summary item from the metadata
        {
          menu_item_id: null,
          quantity: 1,
          price: orderAmount,
          item_name: items_summary || `Order for ${customer_name}`,
          specialInstructions: null,
        },
      ],
      notes: `Order created from payment intent ${paymentIntentId}. Items: ${items_summary || "N/A"}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
          table_number: orderData.table_number,
          customer_name: orderData.customer_name,
          customer_phone: orderData.customer_phone || "",
          customer_email: orderData.customer_email || null,
          items: orderData.items.map((item) => ({
            menu_item_id: item.menu_item_id ?? "custom-item",
            quantity: item.quantity,
            price: item.price,
            item_name: item.item_name,
            specialInstructions: item.specialInstructions ?? undefined,
          })),
          total_amount: orderData.total_amount,
          notes: orderData.notes || null,
          order_status: orderData.order_status,
          payment_status: orderData.payment_status,
          payment_method: orderData.payment_method,
          source: "qr" as const,
        };

        // Use admin client for public route (customer payment flow)
        const order = await orderService.createOrder(venue_id, serviceOrderData);

        if (!order) {
          logger.error("[ORDER CREATION] OrderService returned null", {
            paymentIntentId,
            correlationId,
          });
          throw new Error("Failed to create order: OrderService returned null");
        }

        // Publish realtime event for live orders
        try {
          const { createAdminClient } = await import("@/lib/supabase");
          const adminClient = createAdminClient();
          await adminClient.channel("orders").send({
            type: "broadcast",
            event: "order_created",
            payload: {
              order: {
                ...order,
                order_number: order.id,
              },
              venue_id: venue_id,
              correlation_id: correlationId,
            },
          });
        } catch (realtimeError) {
          logger.error("[ORDER CREATION] Failed to publish realtime event:", {
            error: realtimeError instanceof Error ? realtimeError.message : String(realtimeError),
            correlationId,
          });
          // Don't fail the order creation if realtime fails
        }

        return {
          data: {
            ok: true,
            order: {
              ...order,
              order_number: order.id,
            },
          },
          statusCode: 200,
        };
      },
      3600 // 1 hour TTL
    );

    logger.info("[ORDER FROM INTENT] Order created successfully", {
      orderId: result.data.order.id,
      paymentIntentId,
      venueId: venue_id,
      correlationId,
      cached: result.cached,
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (_error) {
    const correlationId = getCorrelationIdFromRequest(req);

    logger.error("[ORDER CREATION] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
      stack: _error instanceof Error ? _error.stack : undefined,
      correlationId,
    });

    if (_error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          ok: false,
          message: `Stripe error: ${_error.message}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Internal server error",
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
      id: uuidv4(),
      venue_id: "demo-cafe",
      table_number: 1,
      customer_name: "Demo Customer",
      customer_phone: "+1234567890",
      total_amount: 2800, // £28.00 in pence
      order_status: "PLACED",
      payment_status: "PAID",
      payment_intent_id: `demo-${cartId}`,
      payment_method: "PAY_NOW", // Demo orders use PAY_NOW method
      payment_mode: "online", // Required for payment_method consistency constraint
      items: [
        {
          menu_item_id: null,
          quantity: 1,
          price: 1200,
          item_name: "Demo Item 1",
          specialInstructions: null,
        },
        {
          menu_item_id: null,
          quantity: 2,
          price: 800,
          item_name: "Demo Item 2",
          specialInstructions: null,
        },
      ],
      notes: `Demo order created from cart ${cartId}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(demoOrderData)
      .select()
      .single();

    if (orderError) {
      logger.error("[DEMO ORDER] Database error:", { value: orderError });
      return NextResponse.json(
        {
          ok: false,
          message: `Failed to create demo order: ${orderError.message}`,
        },
        { status: 500 }
      );
    }

    // Publish realtime event for live orders
    try {
      await supabase.channel("orders").send({
        type: "broadcast",
        event: "order_created",
        payload: {
          order: {
            ...order,
            order_number: order.id,
          },
          venue_id: "demo-cafe",
        },
      });
    } catch (realtimeError) {
      logger.error("[DEMO ORDER] Failed to publish realtime event:", { value: realtimeError });
      // Don't fail the order creation if realtime fails
    }

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        order_number: order.id,
      },
    });
  } catch (_error) {
    logger.error("[DEMO ORDER] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to create demo order",
      },
      { status: 500 }
    );
  }
}
