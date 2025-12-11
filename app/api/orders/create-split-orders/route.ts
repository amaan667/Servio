import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getStripeClient } from "@/lib/stripe-client";
import { withStripeRetry } from "@/lib/stripe-retry";
import type Stripe from "stripe";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";

interface SplitOrderRequest {
  venueId: string;
  tableNumber: number;
  customerName: string;
  customerPhone: string;
  splits: Array<{
    name: string;
    items: Array<{
      id: string | null;
      name: string;
      price: number;
      quantity: number;
      specialInstructions?: string | null;
      modifiers?: Record<string, string[]> | null;
      modifierPrice?: number;
    }>;
    total: number;
  }>;
  source?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SplitOrderRequest = await req.json();
    const { venueId, tableNumber, customerName, customerPhone, splits, source = "qr" } = body;

    if (!venueId || !splits || splits.length === 0) {
      return apiErrors.badRequest("Missing required fields");
    }

    const supabase = createAdminClient();

    // Verify venue exists
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_id, venue_name")
      .eq("venue_id", venueId)
      .single();

    if (!venue) {
      return apiErrors.notFound("Venue not found");
    }

    // Get or create table
    let tableId: string | null = null;
    const { data: existingTable } = await supabase
      .from("tables")
      .select("id")
      .eq("venue_id", venueId)
      .eq("label", tableNumber.toString())
      .eq("is_active", true)
      .maybeSingle();

    if (existingTable) {
      tableId = existingTable.id;
    } else {
      const { data: newTable, error: tableError } = await supabase
        .from("tables")
        .insert({
          venue_id: venueId,
          label: tableNumber.toString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (tableError || !newTable) {
        logger.error("[SPLIT ORDERS] Failed to create table:", tableError);
        return apiErrors.internal("Failed to create table");
      }
      tableId = newTable.id;
    }

    // Generate a group ID for linking split orders
    const groupId = `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create orders and Stripe checkout sessions for each split
    const createdOrders = [];
    const checkoutSessions = [];

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const splitCustomerName = `${customerName} - ${split.name}`;

      // Create order for this split
      const orderData = {
        venue_id: venueId,
        table_id: tableId,
        table_number: tableNumber,
        customer_name: splitCustomerName,
        customer_phone: customerPhone,
        total_amount: split.total,
        order_status: "PLACED",
        payment_status: "UNPAID",
        payment_mode: "online",
        source: source,
        items: split.items.map((item) => ({
          menu_item_id: item.id,
          item_name: item.name,
          quantity: item.quantity,
          price: item.price + (item.modifierPrice || 0),
          special_instructions: item.specialInstructions || null,
          modifiers: item.modifiers || null,
        })),
        notes: `Split bill - Part ${i + 1} of ${splits.length} (${split.name})`,
        metadata: {
          split_group_id: groupId,
          split_number: i + 1,
          split_total: splits.length,
          split_name: split.name,
        },
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError || !order) {
        logger.error("[SPLIT ORDERS] Failed to create order:", orderError);
        return apiErrors.internal("Failed to create order");
      }

      createdOrders.push(order);

      // Create Stripe checkout session for this split
      const host = req.headers.get("host") || "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const base = `${protocol}://${host}`;

      const amountInPence = Math.round(split.total * 100);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: `Split Bill - ${split.name}`,
                description: `Table ${tableNumber} - ${split.items.length} item(s)`,
              },
              unit_amount: amountInPence,
            },
            quantity: 1,
          },
        ],
        mode: "payment" as const,
        metadata: {
          orderId: order.id,
          venueId: venueId,
          tableNumber: tableNumber.toString(),
          customerName: splitCustomerName,
          customerPhone: customerPhone,
          source: source,
          splitGroupId: groupId,
          splitNumber: (i + 1).toString(),
          splitTotal: splits.length.toString(),
          splitName: split.name,
        },
        success_url: `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}&splitGroupId=${groupId}`,
        cancel_url: `${base}/payment/cancel?orderId=${order.id}&venueId=${venueId}&tableNumber=${tableNumber}`,
      };

      const stripe = getStripeClient();
      const session = await withStripeRetry(() => stripe.checkout.sessions.create(sessionParams), {
        maxRetries: 3,
      });

      checkoutSessions.push({
        orderId: order.id,
        sessionId: session.id,
        url: session.url,
        splitName: split.name,
        amount: split.total,
      });
    }

    logger.info("[SPLIT ORDERS] Created split orders:", {
      groupId,
      orderCount: createdOrders.length,
      venueId,
      tableNumber,
    });

    return NextResponse.json({
      success: true,
      groupId,
      orders: createdOrders.map((o) => ({ id: o.id, customer_name: o.customer_name })),
      checkoutSessions,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[SPLIT ORDERS] Error:", {
      error: err.message,
      stack: err.stack,
    });
    return apiErrors.internal("Internal server error");
  }
}
