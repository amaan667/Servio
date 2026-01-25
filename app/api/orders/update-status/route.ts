import { createApiHandler } from "@/lib/api/production-handler";
import { orderService } from "@/lib/services/OrderService";
import { z } from "zod";

export const runtime = "nodejs";

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.string(),
});

/**
 * POST: Update order status (general status change)
 */
export const POST = createApiHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    
    // Check for specialized transitions
    if (body.status === "COMPLETED") {
      const order = await orderService.completeOrder(body.orderId, venueId);
      return { order };
    }
    
    if (body.status === "SERVED") {
      const order = await orderService.markServed(body.orderId, venueId);
      return { order };
    }

    const order = await orderService.updateOrderStatus(body.orderId, venueId, body.status);
    return { order };
  },
  {
    requireVenueAccess: true,
    schema: updateStatusSchema,
    requireRole: ["owner", "manager", "staff"],
  }
);
