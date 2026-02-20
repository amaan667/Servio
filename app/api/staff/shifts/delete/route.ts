import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const deleteShiftSchema = z.object({
  id: z.string().min(1, "id is required"),
  venue_id: z.string().min(1, "venue_id is required"),
});

export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { id, venue_id } = context.body as z.infer<typeof deleteShiftSchema>;
    const admin = createAdminClient();

    const { error } = await admin
      .from("staff_shifts")
      .delete()
      .eq("id", id)
      .eq("venue_id", venue_id);

    if (error) {
      return apiErrors.badRequest(error.message);
    }

    return { success: true };
  },
  {
    schema: deleteShiftSchema,
    requireVenueAccess: true,
    venueIdSource: "body",
    requireRole: ["owner", "manager"],
  }
);
