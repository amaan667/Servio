import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { orderService } from "@/lib/services/OrderService";
import { z } from "zod";

export const runtime = "nodejs";

const serveOrderSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * POST: Mark order as served
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    const order = await orderService.markServed(body.orderId, venueId);
    return { success: true, order };
  },
  {
    requireVenueAccess: true,
    schema: serveOrderSchema,
    enforceIdempotency: true,
  }
);
