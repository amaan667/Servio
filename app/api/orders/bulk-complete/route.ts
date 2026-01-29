import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { orderService } from "@/lib/services/OrderService";
import { apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/monitoring/structured-logger";
import { z } from "zod";

const bulkCompleteSchema = z
  .object({
    venueId: z.string().optional(),
    venue_id: z.string().optional(),
    orderIds: z.array(z.string()).optional(),
  })
  .refine((d) => (d.venueId ?? d.venue_id) != null, { message: "venueId or venue_id required" });

/**
 * POST: Bulk complete orders
 */
function logBulkComplete(label: string, detail: unknown) {
  logger.info(`[bulk-complete] ${label}`, { detail });
}

export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;

    logBulkComplete("request", { venueId, bodyOrderIds: body.orderIds, bodyOrderIdsLength: body.orderIds?.length });

    // 1. Get IDs to complete
    let orderIds = body.orderIds;
    if (!orderIds || orderIds.length === 0) {
      logBulkComplete("fetching active orders", { venueId });
      const activeOrders = await orderService.getOrders(venueId, {
        status: "PLACED,IN_PREP,READY,SERVING,SERVED",
      });
      logBulkComplete("active orders from getOrders", {
        count: activeOrders?.length,
        orders: activeOrders?.map((o) => ({ id: o.id, order_status: o.order_status, payment_status: o.payment_status })),
      });
      orderIds = activeOrders
        .filter((o) => o.order_status !== "COMPLETED")
        .map((o) => o.id);
    } else {
      const orders = await orderService.getOrders(venueId, {});
      const completedOrderIds = new Set(
        orders.filter((o) => o.order_status === "COMPLETED").map((o) => o.id)
      );
      orderIds = orderIds.filter((id) => !completedOrderIds.has(id));
      logBulkComplete("filtered orderIds", { orderIds, completedOrderIds: [...completedOrderIds] });
    }

    if (!orderIds || orderIds.length === 0) {
      logBulkComplete("no orders to complete", { orderIds });
      return {
        completedCount: 0,
        message: "No active orders to complete",
      };
    }

    logBulkComplete("calling bulkCompleteOrders", { orderIds, venueId });

    try {
      const completedCount = await orderService.bulkCompleteOrders(orderIds, venueId);
      logBulkComplete("done", { completedCount });
      return {
        completedCount,
        message: `Successfully completed ${completedCount} orders and cleaned up tables`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk completion failed";
      logBulkComplete("throw", { message, stack: error instanceof Error ? error.stack : undefined });
      return apiErrors.internal(message, undefined, undefined);
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkCompleteSchema,
    requireRole: ["owner", "manager", "staff"],
  }
);
