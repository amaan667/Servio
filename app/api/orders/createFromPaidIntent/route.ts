import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ENV as _ENV } from "@/lib/env";
import { v4 as uuidv4 } from "uuid";
import { stripe } from "@/lib/stripe-client";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

interface CreateOrderRequest {
  paymentIntentId: string;
  cartId: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();

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

    // Retrieve payment intent from Stripe
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

    // Check for existing order (idempotency)
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("*")
      .eq("payment_intent_id", paymentIntentId)
      .single();

    if (existingOrder) {
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

    // Create order structure with items from payment intent metadata
    const orderAmount = paymentIntent.amount_received || paymentIntent.amount;

    const orderData = {
      id: uuidv4(),
      venue_id,
      table_number: parseInt(table_number),
      customer_name,
      customer_phone: customer_phone || null,
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

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      logger.error("[ORDER CREATION] Database error:", { value: orderError });
      return NextResponse.json(
        {
          ok: false,
          message: `Failed to create order: ${orderError.message}`,
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
          venue_id: venue_id,
        },
      });
    } catch (realtimeError) {
      logger.error("[ORDER CREATION] Failed to publish realtime event:", { value: realtimeError });
      // Don't fail the order creation if realtime fails
    }

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        order_number: order.id, // Use ID as order number for now
      },
    });
  } catch (_error) {
    logger.error("[ORDER CREATION] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
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
