import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId")!;
    const sessionId = searchParams.get("sessionId")!;
    if (!orderId || !sessionId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    console.log('[VERIFY] Checking payment for orderId:', orderId, 'sessionId:', sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('[VERIFY] Stripe session status:', session.payment_status);
    const paid = session.payment_status === "paid";

    if (paid) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(name: string) { return undefined; },
            set(name: string, value: string, options: any) { },
            remove(name: string, options: any) { },
          },
        }
      );
      
      // Find the order by session ID first
      console.log("[VERIFY] Looking for order with session ID:", sessionId);
      let { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, stripe_session_id, payment_status")
        .eq("stripe_session_id", sessionId)
        .single();

      // If not found by session ID, the order might not be created yet (webhook might be delayed)
      if (orderError) {
        console.log("Order not found by session ID, waiting for webhook to create order...");
        console.log("OrderError details:", orderError);
        
        // Debug: Check what orders exist in the database
        const { data: allOrders, error: allOrdersError } = await supabase
          .from("orders")
          .select("id, stripe_session_id, payment_status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (!allOrdersError && allOrders) {
          console.log("Recent orders in database:", allOrders);
        }
        
        // Wait a bit for the webhook to create the order, then try again with retry logic
        let retryCount = 0;
        const maxRetries = 5;
        let orderFound = false;
        
        while (retryCount < maxRetries && !orderFound) {
          console.log(`[VERIFY] Retry attempt ${retryCount + 1}/${maxRetries} for session:`, sessionId);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: retryOrder, error: retryError } = await supabase
            .from("orders")
            .select("id, stripe_session_id, payment_status")
            .eq("stripe_session_id", sessionId)
            .single();

          if (retryOrder && !retryError) {
            console.log("Found order on retry:", retryOrder.id);
            order = retryOrder;
            orderError = null;
            orderFound = true;
          } else {
            console.log(`[VERIFY] Retry ${retryCount + 1} failed:`, retryError?.message || 'No order found');
            retryCount++;
          }
        }

        if (!orderFound) {
          console.error("Order still not found after retry for session:", sessionId);
          
          // Fallback: Create order from session metadata if webhook failed
          console.log("[VERIFY] Webhook failed to create order, creating order as fallback...");
          
          try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            console.log("[VERIFY] Retrieved session for fallback order creation:", session.id);
            
            // Parse items from metadata
            const items = session.metadata?.items ? JSON.parse(session.metadata.items) : [];
            
            // Ensure we have valid items array
            if (!Array.isArray(items) || items.length === 0) {
              console.error("[VERIFY] No valid items found in session metadata");
              return NextResponse.json({ paid: false, error: "No items found in session" }, { status: 400 });
            }
            
            // Ensure items have required fields for database schema
            const formattedItems = items.map((item: any, index: number) => ({
              menu_item_id: item.id || `temp-item-${index}`,
              quantity: item.quantity || 1,
              price: item.price || 0,
              item_name: item.name || `Item ${index + 1}`,
              specialInstructions: null
            }));
            
            const newOrder = {
              venue_id: session.metadata?.venueId || 'default-venue',
              table_number: parseInt(session.metadata?.tableNumber || '1'),
              customer_name: session.metadata?.customerName || 'Customer',
              customer_phone: session.metadata?.customerPhone || '+1234567890',
              items: formattedItems,
              total_amount: session.amount_total ? session.amount_total / 100 : 0,
              order_status: 'PLACED',
              payment_status: 'PAID',
              payment_method: 'stripe',
              payment_mode: 'online',
              source: session.metadata?.source || 'qr',
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            console.log("[VERIFY] Creating fallback order with data:", JSON.stringify(newOrder, null, 2));

            // First, try to insert without select to avoid RLS issues
            const { error: insertError } = await supabase
              .from('orders')
              .insert(newOrder);

            if (insertError) {
              console.error("[VERIFY] Error creating fallback order:", insertError);
              console.error("[VERIFY] Error details:", {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code
              });
              return NextResponse.json({ paid: false, error: `Order not found and fallback creation failed: ${insertError.message}` }, { status: 404 });
            }

            console.log("[VERIFY] Order insert successful, now trying to find the created order...");

            // Wait a moment for the insert to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Try to find the order that was just created
            const { data: foundOrder, error: findError } = await supabase
              .from('orders')
              .select('id, venue_id, table_number, customer_name, total_amount, order_status, payment_status')
              .eq('stripe_session_id', sessionId)
              .single();
            
            if (foundOrder && !findError) {
              console.log("[VERIFY] Found order after insert:", foundOrder.id);
              return NextResponse.json({ paid: true, orderId: foundOrder.id }, { status: 200 });
            } else {
              console.error("[VERIFY] Could not find order after insert attempt:", findError);
              
              // Try alternative approach - find by payment intent ID
              const { data: foundByPaymentIntent, error: findByPaymentIntentError } = await supabase
                .from('orders')
                .select('id, venue_id, table_number, customer_name, total_amount, order_status, payment_status')
                .eq('stripe_payment_intent_id', newOrder.stripe_payment_intent_id)
                .single();
              
              if (foundByPaymentIntent && !findByPaymentIntentError) {
                console.log("[VERIFY] Found order by payment intent ID:", foundByPaymentIntent.id);
                return NextResponse.json({ paid: true, orderId: foundByPaymentIntent.id }, { status: 200 });
              } else {
                console.error("[VERIFY] Could not find order by payment intent ID either:", findByPaymentIntentError);
                return NextResponse.json({ paid: false, error: "Order not found and fallback creation failed - no data returned" }, { status: 404 });
              }
            }

            
          } catch (fallbackError) {
            console.error("[VERIFY] Fallback order creation failed:", fallbackError);
            return NextResponse.json({ paid: false, error: "Order not found - webhook may be delayed" }, { status: 404 });
          }
        }
      }

      if (!order) {
        console.error("Order is null after all attempts to find it");
        return NextResponse.json({ paid: false, error: "Order not found" }, { status: 404 });
      }

      return NextResponse.json({ paid: true, orderId: order.id }, { status: 200 });
    }

    return NextResponse.json({ paid: false }, { status: 200 });
  } catch (e: any) {
    console.error("verify error:", e);
    return NextResponse.json({ error: e.message ?? "verify failed" }, { status: 500 });
  }
}
