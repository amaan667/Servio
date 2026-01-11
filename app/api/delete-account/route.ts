import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.STRICT);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Parse request
      const body = await req.json();
      const { userId, venueId } = body;

      // STEP 4: Validate inputs
      if (!userId) {
        return apiErrors.badRequest("User ID is required");
      }

      // STEP 5: Security - Verify user can only delete their own account
      if (user.id !== userId) {
        return apiErrors.forbidden("You can only delete your own account");
      }

      // STEP 6: Business logic
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

        throw error;
      }

      // STEP 7: Return success response
      return success({});
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      if (errorMessage.includes("Unauthorized")) {
        return apiErrors.unauthorized(errorMessage);
      }
      if (errorMessage.includes("Forbidden")) {
        return apiErrors.forbidden(errorMessage);
      }

      return apiErrors.internal(
        isDevelopment() ? errorMessage : "Request processing failed",
        isDevelopment() && errorStack ? { stack: errorStack } : undefined
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
