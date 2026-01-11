import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getStripeClient } from "@/lib/stripe-client";
import { withStripeRetry } from "@/lib/stripe-retry";
import type Stripe from "stripe";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

interface SplitOrderRequest {

      modifiers?: Record<string, string[]> | null;
      modifierPrice?: number;
    }>;

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

        .select("id")
        .single();

      if (tableError || !newTable) {
        
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

        })),
        notes: `Split bill - Part ${i + 1} of ${splits.length} (${split.name})`,

        },
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError || !order) {
        
        return apiErrors.internal("Failed to create order");
      }

      createdOrders.push(order);

      // Create Stripe checkout session for this split
      const host = req.headers.get("host") || "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const base = `${protocol}://${host}`;

      const amountInPence = Math.round(split.total * 100);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {

                name: `Split Bill - ${split.name}`,
                description: `Table ${tableNumber} - ${split.items.length} item(s)`,
              },

            },

          },
        ],

        },
        success_url: `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}&splitGroupId=${groupId}`,
        cancel_url: `${base}/payment/cancel?orderId=${order.id}&venueId=${venueId}&tableNumber=${tableNumber}`,
      };

      const stripe = getStripeClient();
      const session = await withStripeRetry(() => stripe.checkout.sessions.create(sessionParams), {

      checkoutSessions.push({

    }

    

    return NextResponse.json({

      groupId,
      orders: createdOrders.map((o) => ({ id: o.id, customer_name: o.customer_name })),
      checkoutSessions,

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    return apiErrors.internal("Internal server error");
  }
}
