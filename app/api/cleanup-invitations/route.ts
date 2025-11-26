import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/cleanup-invitations - Clean up cancelled invitations and fix constraint (Cookie-free)
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

      // Step 1: Delete all cancelled invitations to clean up the database
      const { data: deletedInvitations, error: deleteError } = await supabase
        .from("staff_invitations")
        .delete()
        .eq("status", "cancelled")
        .select("id, email, venue_id");

      if (deleteError) {
        logger.error("[CLEANUP INVITATIONS] Error deleting cancelled invitations:", {
          error: deleteError.message || "Unknown error",
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to clean up cancelled invitations",
            details: deleteError.message,
            message: process.env.NODE_ENV === "development" ? deleteError.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      // Step 2: Try to fix the database constraint
      try {
        // Drop the problematic constraint
        await supabase.rpc("exec_sql", {
          sql: "ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;",
        });

        // Create the new partial unique index
        await supabase.rpc("exec_sql", {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
                ON staff_invitations (venue_id, email) 
                WHERE status = 'pending';`,
        });
      } catch (constraintError) {
        logger.warn("[CLEANUP INVITATIONS] Could not fix constraint (this is okay)", {
          error: constraintError instanceof Error ? constraintError.message : "Unknown error",
          userId: context.user.id,
        });
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: `Cleanup completed successfully. Deleted ${deletedInvitations?.length || 0} cancelled invitations.`,
        deletedCount: deletedInvitations?.length || 0,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[CLEANUP INVITATIONS] Unexpected error:", {
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
