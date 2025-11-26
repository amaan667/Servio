import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/fix-invitation-constraint - Direct fix for invitation constraint (Cookie-free)
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Step 1: Get all cancelled invitations and delete them
      const { data: cancelledInvitations, error: fetchError } = await supabase
        .from("staff_invitations")
        .select("id, email, venue_id")
        .eq("status", "cancelled");

      if (fetchError) {
        logger.error("[CONSTRAINT FIX] Error fetching cancelled invitations:", {
          error: fetchError.message,
          userId: context.user.id,
        });
      } else {
        logger.debug(
          `[CONSTRAINT FIX] Found ${cancelledInvitations?.length || 0} cancelled invitations`
        );
      }

      // Step 2: Delete all cancelled invitations
      const { error: deleteError } = await supabase
        .from("staff_invitations")
        .delete()
        .eq("status", "cancelled");

      if (deleteError) {
        logger.error("[CONSTRAINT FIX] Error deleting cancelled invitations:", {
          error: deleteError.message,
          userId: context.user.id,
        });
      }

      // Step 3: Try to work around the constraint by using a different approach
      // We'll modify the cancel logic to handle this better

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Constraint fix completed. Cancelled invitations have been removed.",
        deletedCount: cancelledInvitations?.length || 0,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[CONSTRAINT FIX] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
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
