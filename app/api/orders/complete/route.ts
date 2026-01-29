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

    const order = await orderService.completeOrder(body.orderId, venueId, {
      forced: body.forced,
      userId: user.id,
      forcedReason: body.forcedReason,
    });

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
