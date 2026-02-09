import { createOrderSchema } from "@/lib/api/validation-schemas";
import { orderService } from "@/lib/services/OrderService";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET: Fetch orders for a venue
 */
export const GET = createUnifiedHandler(
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
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;

    const targetVenueId = venueId || body.venue_id;
    if (!targetVenueId) {
      throw new Error("venue_id is required");
    }

    // 1. Create Order via Service (Atomic Transaction)
    let result;
    try {
      result = await orderService.createOrder(targetVenueId, {
        ...body,
        source: (body.source as "qr" | "counter") || "qr",
        fulfillment_type: body.qr_type === "COUNTER" ? "counter" : "table",
        counter_label: body.counter_label || body.counter_identifier || null,
      });
    } catch (error) {
      throw error;
    }

    // 2. Enqueue KDS Ticket Creation (fully async via BullMQ)
    try {
      const paymentMethod = (body.payment_method || "PAY_NOW").toUpperCase();
      const paymentStatus = (body.payment_status || "UNPAID").toUpperCase();

      const shouldCreateTickets = paymentMethod !== "PAY_NOW" || paymentStatus === "PAID";

      if (shouldCreateTickets) {
        const { jobHelpers } = await import("@/lib/queue");
        jobHelpers
          .addKDSTicketJob({
            orderId: result.id,
            venueId: result.venue_id,
            items: result.items.map((item) => ({
              item_name: item.item_name,
              quantity: item.quantity,
              specialInstructions: (item.special_instructions || undefined) as string | undefined,
              modifiers: item.modifiers,
            })),
            customerName: result.customer_name,
            tableNumber: result.table_number ? parseInt(String(result.table_number), 10) : null,
            tableId: result.table_id as string,
          })
          .catch(() => {
            // Queue enqueue failure is non-critical
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
    requireAuth: false, // Public: customer ordering UI (no login)
    requireVenueAccess: false, // Venue comes from body.venue_id only
    schema: createOrderSchema,
    rateLimit: RATE_LIMITS.GENERAL,
    enforceIdempotency: false,
  }
);
