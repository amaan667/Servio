import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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

export async function GET(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
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

    const supabase = createAdminClient();

    // Get all users
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      logger.error("[CLEANUP] Error fetching users:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
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

    logger.info("[CLEANUP] Found incomplete accounts", {
      total: incompleteAccounts.length,
      verified: verified.length,
      unverified: unverified.length,
    });

    return NextResponse.json({
      accounts: incompleteAccounts,
      count: incompleteAccounts.length,
      breakdown: {
        verified: verified.length,
        unverified: unverified.length,
      },
    });
  } catch (error) {
    logger.error("[CLEANUP] Error:", error);
    return NextResponse.json({ error: "Failed to identify incomplete accounts" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = createAdminClient();

    // Get all users
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      logger.error("[CLEANUP] Error fetching users:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
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
          logger.error(`[CLEANUP] Failed to delete user ${userId}:`, error);
          errorCount++;
          // Get email for error reporting
          const user = usersData.users.find((u: { id: string; email?: string }) => u.id === userId);
          errors.push({
            id: userId,
            email: user?.email || null,
            error: error.message,
          });
        } else {
          deletedCount++;
          logger.info(`[CLEANUP] Deleted user: ${userId}`);
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

    logger.info("[CLEANUP] Deletion complete", {
      deleted: deletedCount,
      errors: errorCount,
      total: accountsToDelete.length,
    });

    return NextResponse.json({
      deleted: deletedCount,
      errors: errorCount,
      total: accountsToDelete.length,
      errorDetails: errors,
    });
  } catch (error) {
    logger.error("[CLEANUP] Fatal error:", error);
    return NextResponse.json({ error: "Failed to delete accounts" }, { status: 500 });
  }
}
