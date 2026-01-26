import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { orderService } from "@/lib/services/OrderService";
import { z } from "zod";

export const runtime = "nodejs";

const updatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentStatus: z.string(),
  paymentMethod: z.string().optional(),
});

/**
 * POST: Update order payment status
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    
    const order = await orderService.updatePaymentStatus(
      body.orderId, 
      venueId, 
      body.paymentStatus, 
      body.paymentMethod
    );

    return { success: true, order };
  },
  {
    requireVenueAccess: true,
    schema: updatePaymentSchema,
    requireRole: ["owner", "manager", "staff"],
    enforceIdempotency: true,
  }
);
