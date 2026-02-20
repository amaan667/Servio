import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const updateShiftSchema = z.object({
  id: z.string().min(1, "id is required"),
  venue_id: z.string().min(1, "venue_id is required"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  area: z.string().optional(),
});

export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { id, venue_id, start_time, end_time, area } = context.body as z.infer<
      typeof updateShiftSchema
    >;

    const updates: Record<string, string | null> = {};
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (area !== undefined) updates.area = area || null;

    if (Object.keys(updates).length === 0) {
      return apiErrors.badRequest("No fields to update");
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("staff_shifts")
      .update(updates)
      .eq("id", id)
      .eq("venue_id", venue_id)
      .select("*");

    if (error) {
      return apiErrors.badRequest(error.message);
    }

    return { data: data || [] };
  },
  {
    schema: updateShiftSchema,
    requireVenueAccess: true,
    venueIdSource: "body",
    requireRole: ["owner", "manager"],
  }
);
