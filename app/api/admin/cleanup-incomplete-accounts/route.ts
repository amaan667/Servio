import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";

/**
 * Admin endpoint to identify and optionally delete incomplete accounts
 *
 * GET /api/admin/cleanup-incomplete-accounts - List incomplete accounts
 * DELETE /api/admin/cleanup-incomplete-accounts - Delete incomplete accounts
 *
 * Incomplete accounts are users who:
 * - Don't own any venues
 * - Don't have staff roles
 * - Don't have organizations
 *
 * These are typically accounts created before the plan selection flow was introduced
 */

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
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
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)
      // Note: This is an admin route - consider adding admin role check

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Get all users
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

      if (usersError) {
        logger.error("[CLEANUP GET] Error fetching users:", {
          error: usersError,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch users",
            message: isDevelopment() ? usersError.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      if (!usersData?.users) {
        return NextResponse.json({ accounts: [], count: 0 });
      }

      const incompleteAccounts: Array<{
        id: string;
        email: string | null;
        created_at: string;
        email_confirmed_at: string | null;
        full_name: string | null;
        has_venue: boolean;
        has_staff_role: boolean;
        has_organization: boolean;
        onboarding_step: number | null;
      }> = [];

      // Check each user
      for (const user of usersData.users) {
        // Check if user owns any venues
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", user.id)
          .limit(1);

        // Check if user has staff roles
        const { data: staffRoles } = await supabase
          .from("user_venue_roles")
          .select("venue_id")
          .eq("user_id", user.id)
          .limit(1);

        // Check if user has organization
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id")
          .eq("owner_user_id", user.id)
          .limit(1);

        // Check onboarding progress
        const { data: onboarding } = await supabase
          .from("onboarding_progress")
          .select("current_step")
          .eq("user_id", user.id)
          .maybeSingle();

        const hasVenue = venues && venues.length > 0;
        const hasStaffRole = staffRoles && staffRoles.length > 0;
        const hasOrganization = orgs && orgs.length > 0;

        // If user has no venue, no staff role, and no organization, they're incomplete
        if (!hasVenue && !hasStaffRole && !hasOrganization) {
          incompleteAccounts.push({
            id: user.id,
            email: user.email || null,
            created_at: user.created_at,
            email_confirmed_at: user.email_confirmed_at || null,
            full_name: (user.user_metadata?.full_name as string) || null,
            has_venue: !!hasVenue,
            has_staff_role: !!hasStaffRole,
            has_organization: !!hasOrganization,
            onboarding_step: onboarding?.current_step || null,
          });
        }
      }

      // Group by verification status
      const verified = incompleteAccounts.filter((a) => a.email_confirmed_at);
      const unverified = incompleteAccounts.filter((a) => !a.email_confirmed_at);

      logger.info("[CLEANUP GET] Found incomplete accounts", {
        total: incompleteAccounts.length,
        verified: verified.length,
        unverified: unverified.length,
        userId: context.user.id,
      });

      // STEP 7: Return success response
      return NextResponse.json({
        accounts: incompleteAccounts,
        count: incompleteAccounts.length,
        breakdown: {
          verified: verified.length,
          unverified: unverified.length,
        },
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[CLEANUP GET] Unexpected error:", {
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

export const DELETE = withUnifiedAuth(
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
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)
      // Note: This is an admin route - consider adding admin role check

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Get all users
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

      if (usersError) {
        logger.error("[CLEANUP DELETE] Error fetching users:", {
          error: usersError,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch users",
            message: isDevelopment() ? usersError.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      if (!usersData?.users) {
        return NextResponse.json({ deleted: 0, errors: 0 });
      }

      const accountsToDelete: string[] = [];

      // Identify incomplete accounts
      for (const user of usersData.users) {
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", user.id)
          .limit(1);

        const { data: staffRoles } = await supabase
          .from("user_venue_roles")
          .select("venue_id")
          .eq("user_id", user.id)
          .limit(1);

        const { data: orgs } = await supabase
          .from("organizations")
          .select("id")
          .eq("owner_user_id", user.id)
          .limit(1);

        const hasVenue = venues && venues.length > 0;
        const hasStaffRole = staffRoles && staffRoles.length > 0;
        const hasOrganization = orgs && orgs.length > 0;

        if (!hasVenue && !hasStaffRole && !hasOrganization) {
          accountsToDelete.push(user.id);
        }
      }

      // Delete accounts
      let deletedCount = 0;
      let errorCount = 0;
      const errors: Array<{ id: string; email: string | null; error: string }> = [];

      for (const userId of accountsToDelete) {
        try {
          const { error } = await supabase.auth.admin.deleteUser(userId);
          if (error) {
            logger.error(`[CLEANUP DELETE] Failed to delete user ${userId}:`, {
              error: error.message,
              userId: context.user.id,
            });
            errorCount++;
            // Get email for error reporting
            const user = usersData.users.find(
              (u: { id: string; email?: string }) => u.id === userId
            );
            errors.push({
              id: userId,
              email: user?.email || null,
              error: error.message,
            });
          } else {
            deletedCount++;
            logger.info(`[CLEANUP DELETE] Deleted user: ${userId}`);
          }
        } catch (err) {
          errorCount++;
          const user = usersData.users.find((u) => u.id === userId);
          errors.push({
            id: userId,
            email: user?.email || null,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      logger.info("[CLEANUP DELETE] Deletion complete", {
        deleted: deletedCount,
        errors: errorCount,
        total: accountsToDelete.length,
        userId: context.user.id,
      });

      // STEP 7: Return success response
      return NextResponse.json({
        deleted: deletedCount,
        errors: errorCount,
        total: accountsToDelete.length,
        errorDetails: errors,
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[CLEANUP DELETE] Unexpected error:", {
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
