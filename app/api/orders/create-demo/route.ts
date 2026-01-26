import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

interface CreateDemoOrderRequest {
  venueId: string;
  venueName?: string;
  tableNumber?: number;
  counterNumber?: string;
  orderType?: string;
  orderLocation?: string;
  cart: Array<{
    id?: string | null;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string | null;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
  orderId: string;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body: CreateDemoOrderRequest = await req.json();

    // Validate required fields
    if (!body.venueId || !body.orderId) {
      return apiErrors.badRequest("venueId and orderId are required");
    }

    if (!body.cart || body.cart.length === 0) {
      return apiErrors.badRequest("Cart must contain at least one item");
    }

    const supabase = createAdminClient();

    // Determine fulfillment type
    const isCounterOrder = !!body.counterNumber || body.orderType === "counter";
    const fulfillmentType = isCounterOrder ? "counter" : "table";
    const tableNumber = isCounterOrder ? null : (body.tableNumber || 1);
    const counterLabel = isCounterOrder
      ? body.counterNumber || `Counter ${body.tableNumber || "A"}`
      : null;

    // Transform cart items
    const items = body.cart.map((item) => ({
      menu_item_id: null, // Demo orders don't need menu_item_id
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      item_name: item.name,
      special_instructions: item.specialInstructions || null,
    }));

    // Create demo order
    const demoOrderData = {
      id: body.orderId.startsWith("demo-") ? body.orderId : `demo-${body.orderId}`,
      venue_id: body.venueId,
      table_number: tableNumber,
      counter_label: counterLabel,
      fulfillment_type: fulfillmentType,
      customer_name: body.customerName || "Demo Customer",
      customer_phone: body.customerPhone || "+1234567890",
      customer_email: null,
      total_amount: body.total,
      order_status: "PLACED",
      fulfillment_status: "PREPARING",
      qr_type: body.orderType === "counter" ? "COUNTER" : "TABLE_FULL_SERVICE",
      payment_status: "PAID", // Demo orders are marked as paid immediately
      payment_method: "PAY_NOW",
      payment_mode: "online",
      source: isCounterOrder ? "counter" : "qr",
      items,
      notes: `Demo order - ${body.cart.map((i) => `${i.name} x${i.quantity}`).join(", ")}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(demoOrderData)
      .select()
      .single();

    if (orderError) {
      return NextResponse.json(
        {
          ok: false,
          error: orderError.message || "Failed to create demo order",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      order,
    });
  } catch (error) {
    return apiErrors.internal(
      "Failed to create demo order",
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
