import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.STRICT);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Parse request
      const body = await req.json();
      const { userId, venueId } = body;

      // STEP 4: Validate inputs
      if (!userId) {
        return apiErrors.badRequest('User ID is required');
      }

      // STEP 5: Security - Verify user can only delete their own account
      if (user.id !== userId) {
        return NextResponse.json(
          { error: "Unauthorized", message: "You can only delete your own account" },
          { status: 403 }
        );
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
        logger.error("[DELETE ACCOUNT] Error deleting user:", {
          error: error.message,
          userId,
        });
        throw error;
      }

      // STEP 7: Return success response
      return NextResponse.json({ success: true });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[DELETE ACCOUNT] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            success: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
