import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

const deleteAccountSchema = z.object({
  userId: z.string().uuid(),
  venueId: z.string().optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body, user } = context;
    const { userId, venueId } = body;

    // Validation already done by unified handler schema
    // Security - Verify user can only delete their own account
    if (!user || user.id !== userId) {
      return apiErrors.forbidden("You can only delete your own account");
    }

    // Business logic
    const supabase = createAdminClient();

    // Delete venue and related data if venueId provided
    if (venueId) {
      // Verify venue belongs to user
      const { data: venue } = await supabase
        .from("venues")
        .select("venue_id, owner_user_id")
        .eq("venue_id", venueId)
        .eq("owner_user_id", user.id)
        .single();

      if (venue) {
        await supabase.from("venues").delete().eq("venue_id", venueId);
        // Optionally: delete related menu_items, orders, etc.
      }
    }

    // Delete user from Auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      return apiErrors.internal("Failed to delete user account");
    }

    return success({});
  },
  {
    schema: deleteAccountSchema,
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.STRICT,
  }
);
