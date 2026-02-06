import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { orderService } from "@/lib/services/OrderService";
import { z } from "zod";

export const runtime = "nodejs";

const completeOrderSchema = z.object({
  orderId: z.string().uuid(),
  forced: z.boolean().optional(),
  forcedReason: z.string().optional(),
});

/**
 * POST: Mark order as completed and clean up table session
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId, user, role } = context;

    // Security check for forced completion
    if (body.forced && !["owner", "manager"].includes(role)) {
      throw new Error("Forbidden: Forced completion requires owner or manager role");
    }

    // Try RPC first, fallback to direct update if RPC fails
    let order;
    try {
      order = await orderService.completeOrder(body.orderId, venueId, {
        forced: body.forced,
        userId: user.id,
        forcedReason: body.forcedReason,
      });
    } catch (rpcError) {
      // Fallback to direct update when RPC fails (e.g., ambiguous column error)
      order = await orderService.forceCompleteOrder(body.orderId, venueId);
      // Run table cleanup after fallback so table state stays consistent
      if (order.table_id || order.table_number) {
        const { cleanupTableOnOrderCompletion } = await import("@/lib/table-cleanup");
        await cleanupTableOnOrderCompletion({
          venueId,
          tableId: order.table_id || undefined,
          tableNumber: order.table_number?.toString() || undefined,
          orderId: body.orderId,
        });
      }
    }

    return {
      success: true,
      message: body.forced ? "Order force-completed" : "Order completed",
      order,
    };
  },
  {
    requireVenueAccess: true,
    schema: completeOrderSchema,
    enforceIdempotency: true,
  }
);
