import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

const reviewSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().max(500, "Comment too long").optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;

    // Business logic
    const admin = await createClient();

      // Verify order exists
      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id, venue_id")
        .eq("id", body.orderId)
        .maybeSingle();

      if (orderError || !order) {

        return apiErrors.notFound("Order not found");
      }

    // Insert review
    const { error: insErr } = await admin.from("reviews").insert({
      order_id: body.orderId,
      venue_id: order.venue_id,
      rating: body.rating,
      comment: (body.comment ?? "").slice(0, 500),
    });

    if (insErr) {
      return apiErrors.database("Failed to save review");
    }

    return success({ success: true });
  },
  {
    schema: reviewSchema,
    requireAuth: false, // Reviews can be submitted by customers
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
