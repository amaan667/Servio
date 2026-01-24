import { createAdminClient } from "@/lib/supabase";
import { createOrderSchema } from "@/lib/api/validation-schemas";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";
import { orderService } from "@/lib/services/OrderService";
import { createApiHandler } from "@/lib/api/production-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET: Fetch orders for a venue
 */
export const GET = createApiHandler(
  async (_req, context) => {
    const { searchParams } = _req.nextUrl;
    const status = searchParams.get("status") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const orders = await orderService.getOrders(context.venueId, {
      status,
      limit,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    });

    return { orders };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

/**
 * POST: Create a new order (Public Customer Route)
 */
export const POST = createApiHandler(
  async (_req, context) => {
    const { body, venueId } = context;

    // 1. Create Order via Service (Atomic Transaction)
    const result = await orderService.createOrder(venueId || body.venue_id, {
      ...body,
      source: (body.source as "qr" | "counter") || "qr",
      fulfillment_type: body.qr_type === "COUNTER" ? "counter" : "table",
      counter_label: body.counter_label || body.counter_identifier || null,
    });

    // 2. Async KDS Ticket Creation (Non-blocking)
    try {
      const supabase = createAdminClient();
      const paymentMethod = (body.payment_method || "PAY_NOW").toUpperCase();
      const paymentStatus = (body.payment_status || "UNPAID").toUpperCase();

      const shouldCreateTickets = paymentMethod !== "PAY_NOW" || paymentStatus === "PAID";

      if (shouldCreateTickets) {
        // Run in background
        createKDSTicketsWithAI(supabase, {
          id: result.id,
          venue_id: result.venue_id,
          items: result.items.map(item => ({
            item_name: item.item_name,
            quantity: item.quantity,
            specialInstructions: (item.specialInstructions || item.special_instructions || undefined) as string | undefined,
            modifiers: item.modifiers,
          })),
          customer_name: result.customer_name,
          table_number: result.table_number ? parseInt(String(result.table_number), 10) : null,
          table_id: result.table_id as string,
        }).catch(_err => {
          // Silent error in production
        });

        if (paymentMethod === "PAY_LATER" || paymentMethod === "PAY_AT_TILL") {
          await orderService.updateOrderStatus(result.id, result.venue_id, "IN_PREP");
        }
      }
    } catch (_kdsError) {
      // Silent error in production
    }

    return {
      order: result,
      table_auto_created: result.table_auto_created,
      session_id: result.session_id,
      source: body.source || "qr",
    };
  },
  {
    requireAuth: false, // Public route for customers
    schema: createOrderSchema,
    rateLimit: RATE_LIMITS.GENERAL,
    enforceIdempotency: false, // Optional for now, but recommended
  }
);
