import { createServerSupabase } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const deleteOrderSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  venue_id: z.string().min(1, "venue_id is required"),
});

export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { orderId, venue_id } = context.body as z.infer<typeof deleteOrderSchema>;

    if (!orderId || !venue_id) {
      return apiErrors.badRequest("orderId and venue_id required");
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("venue_id", venue_id);

    if (error) {
      return apiErrors.database(error.message);
    }

    return {};
  },
  {
    schema: deleteOrderSchema,
    requireVenueAccess: true,
    venueIdSource: "body",
  }
);
