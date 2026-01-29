import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { orderService } from "@/lib/services/OrderService";
import { apiErrors } from "@/lib/api/standard-response";
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
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    
    // 1. Get IDs to complete
    let orderIds = body.orderIds;
    if (!orderIds || orderIds.length === 0) {
      // Include SERVED orders but exclude COMPLETED orders (they still need payment)
      const activeOrders = await orderService.getOrders(venueId, {
        status: "PLACED,IN_PREP,READY,SERVING,SERVED",
      });
      // Filter out already COMPLETED orders - they shouldn't be overridden
      orderIds = activeOrders
        .filter(o => o.order_status !== "COMPLETED")
        .map(o => o.id);
    } else {
      // If specific order IDs provided, filter out COMPLETED ones
      const orders = await orderService.getOrders(venueId, {});
      const completedOrderIds = new Set(
        orders.filter(o => o.order_status === "COMPLETED").map(o => o.id)
      );
      orderIds = orderIds.filter(id => !completedOrderIds.has(id));
    }

    if (!orderIds || orderIds.length === 0) {
      return { 
        completedCount: 0, 
        message: "No active orders to complete" 
      };
    }

    // 2. Execute Bulk Completion
    try {
      const completedCount = await orderService.bulkCompleteOrders(orderIds, venueId);
      return {
        completedCount,
        message: `Successfully completed ${completedCount} orders and cleaned up tables`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk completion failed";
      return apiErrors.internal(message, undefined, undefined);
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkCompleteSchema,
    requireRole: ["owner", "manager", "staff"],
  }
);
