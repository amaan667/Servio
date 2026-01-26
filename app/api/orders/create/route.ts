import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors } from "@/lib/api/standard-response";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  normalizeQrType,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";

export const runtime = "nodejs";

interface CreateOrderRequest {
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
    image?: unknown;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
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

    const body: CreateOrderRequest = await req.json();

    // Validate required fields
    if (!body.venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    if (!body.customerName || !body.customerPhone) {
      return apiErrors.badRequest("customerName and customerPhone are required");
    }

    if (!body.cart || body.cart.length === 0) {
      return apiErrors.badRequest("Cart must contain at least one item");
    }

    if (!body.total || body.total <= 0) {
      return apiErrors.badRequest("Total must be greater than 0");
    }

    const supabase = createAdminClient();

    // Verify venue exists
    const { data: venue, error: venueErr } = await supabase
      .from("venues")
      .select("venue_id, allow_pay_at_till_for_table_collection")
      .eq("venue_id", body.venueId)
      .maybeSingle();

    if (venueErr) {
      return apiErrors.internal(`Failed to verify venue: ${venueErr.message}`);
    }

    if (!venue) {
      return apiErrors.notFound("Venue not found");
    }

    // Determine order source and fulfillment type
    const isCounterOrder = !!body.counterNumber || body.orderType === "counter";
    const orderSource = isCounterOrder ? ("counter" as const) : ("qr" as const);
    const fulfillmentType = isCounterOrder ? ("counter" as const) : ("table" as const);

    // Handle table number
    let tableId = null;
    let tableNumber: number | null = null;

    if (!isCounterOrder && body.tableNumber) {
      tableNumber = typeof body.tableNumber === "number" ? body.tableNumber : parseInt(String(body.tableNumber)) || null;

      if (tableNumber) {
        // Check if table exists
        const { data: existingTable } = await supabase
          .from("tables")
          .select("id, label")
          .eq("venue_id", body.venueId)
          .eq("label", tableNumber.toString())
          .eq("is_active", true)
          .maybeSingle();

        if (existingTable) {
          tableId = existingTable.id;
        } else {
          // Auto-create table
          const { data: newTable, error: tableCreateErr } = await supabase
            .from("tables")
            .insert({
              venue_id: body.venueId,
              label: tableNumber.toString(),
              seat_count: 4,
              area: null,
              is_active: true,
            })
            .select("id, label")
            .single();

          if (!tableCreateErr && newTable) {
            tableId = newTable.id;
          }
        }
      }
    }

    // Determine counter label
    const counterLabel = isCounterOrder
      ? body.counterNumber || `Counter ${body.tableNumber || "A"}`
      : null;

    // Determine QR type
    const explicitQrType = normalizeQrType(body.orderType || null);
    const derivedQrType = deriveQrTypeFromOrder({
      qr_type: explicitQrType,
      fulfillment_type: fulfillmentType,
      source: orderSource,
      requires_collection: false,
    });

    // Normalize payment method (default to PAY_NOW for order summary flow)
    const paymentMethod = normalizePaymentMethod("PAY_NOW") || "PAY_NOW";

    // Validate payment method for QR type
    const paymentValidation = validatePaymentMethodForQrType({
      qrType: derivedQrType,
      paymentMethod,
      allowPayAtTillForTableCollection: venue.allow_pay_at_till_for_table_collection === true,
    });

    if (!paymentValidation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: paymentValidation.error,
        },
        { status: 400 }
      );
    }

    // Transform cart items to API format
    const items = body.cart.map((item) => {
      // Validate menu_item_id - must be valid UUID or null
      let menuItemId: string | null = null;
      if (item.id && item.id !== "unknown" && item.id !== "null") {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(item.id)) {
          menuItemId = item.id;
        }
      }

      return {
        menu_item_id: menuItemId,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        item_name: item.name,
        special_instructions: item.specialInstructions || null,
        specialInstructions: item.specialInstructions || null, // Support both formats
      };
    });

    // Compute total from items for validation
    const computedTotal = items.reduce((sum, item) => {
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);

    // Use provided total if it matches computed total (within 0.01 tolerance), otherwise use computed
    const finalTotal =
      Math.abs(computedTotal - body.total) < 0.01 ? body.total : computedTotal;

    // Determine payment mode based on payment method
    const paymentMode = (() => {
      if (paymentMethod === "PAY_NOW") return "online";
      if (paymentMethod === "PAY_AT_TILL") return "offline";
      if (paymentMethod === "PAY_LATER") return "deferred";
      return "online";
    })();

    // Create order payload
    const orderPayload = {
      venue_id: body.venueId,
      table_number: isCounterOrder ? null : tableNumber,
      table_id: isCounterOrder ? null : tableId,
      fulfillment_type: fulfillmentType,
      counter_label: counterLabel,
      qr_type: derivedQrType,
      fulfillment_status: "PREPARING" as const,
      customer_name: body.customerName.trim(),
      customer_phone: body.customerPhone.trim(),
      items,
      total_amount: finalTotal,
      notes: null,
      order_status: "PLACED" as const,
      payment_status: "UNPAID" as const,
      payment_mode: paymentMode,
      payment_method: paymentMethod,
      requires_collection: false,
      source: orderSource,
    };

    // Use OrderService RPC function to create order
    const { data: createdOrder, error: createError } = await supabase.rpc(
      "create_order_with_session",
      {
        p_venue_id: body.venueId,
        p_table_number: orderPayload.table_number,
        p_fulfillment_type: orderPayload.fulfillment_type,
        p_counter_label: orderPayload.counter_label,
        p_customer_name: orderPayload.customer_name,
        p_customer_phone: orderPayload.customer_phone,
        p_customer_email: null,
        p_items: orderPayload.items as unknown as Record<string, unknown>,
        p_total_amount: orderPayload.total_amount,
        p_notes: orderPayload.notes,
        p_order_status: orderPayload.order_status,
        p_payment_status: orderPayload.payment_status,
        p_payment_method: orderPayload.payment_method,
        p_payment_mode: paymentMode,
        p_source: orderPayload.source,
        p_seat_count: 4,
      }
    );

    if (createError || !createdOrder) {
      return NextResponse.json(
        {
          ok: false,
          error: createError?.message || "Failed to create order",
        },
        { status: 400 }
      );
    }

    // Return success response
    return NextResponse.json({
      ok: true,
      orderId: (createdOrder as { id: string }).id,
      order: createdOrder,
    });
  } catch (error) {
    return apiErrors.internal(
      "Failed to create order",
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
