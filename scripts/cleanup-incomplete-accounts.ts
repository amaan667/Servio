/**
 * Cleanup Incomplete Accounts Script
 *
 * This script identifies and optionally removes accounts that were created
 * before the plan selection flow was introduced. These accounts exist but
 * don't have proper subscriptions/venues set up.
 *
 * Usage:
 * 1. Run: npx tsx scripts/cleanup-incomplete-accounts.ts --dry-run
 * 2. Review the output
 * 3. Run: npx tsx scripts/cleanup-incomplete-accounts.ts --delete
 *
 * WARNING: The --delete flag will permanently delete accounts!
 */

import { createAdminClient } from "../lib/supabase";
import { logger } from "../lib/logger";

interface IncompleteAccount {
  id: string;
  email: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  full_name: string | null;
  has_venue: boolean;
  has_staff_role: boolean;
  has_organization: boolean;
  onboarding_step: number | null;
}

async function findIncompleteAccounts() {
  const supabase = createAdminClient();

  // Get all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    logger.error("[CLEANUP] Error fetching users:", usersError);
    throw usersError;
  }

  if (!users) {
    logger.info("[CLEANUP] No users found");
    return [];
  }

  logger.info(`[CLEANUP] Found ${users.users.length} total users`);

  const incompleteAccounts: IncompleteAccount[] = [];

  // Check each user
  for (const user of users.users) {
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
        has_venue: hasVenue,
        has_staff_role: hasStaffRole,
        has_organization: hasOrganization,
        onboarding_step: onboarding?.current_step || null,
      });
    }
  }

  return incompleteAccounts;
}

async function deleteAccount(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  return error;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run") || !args.includes("--delete");
  const shouldDelete = args.includes("--delete");

  logger.info(`[CLEANUP] Starting cleanup (dry-run: ${isDryRun})`);

  try {
    const incompleteAccounts = await findIncompleteAccounts();

    logger.info(`[CLEANUP] Found ${incompleteAccounts.length} incomplete accounts`);

    if (incompleteAccounts.length === 0) {
      logger.info("[CLEANUP] No incomplete accounts found. Nothing to clean up.");
      return;
    }

    // Group by verification status
    const verified = incompleteAccounts.filter((a) => a.email_confirmed_at);
    const unverified = incompleteAccounts.filter((a) => !a.email_confirmed_at);

    logger.info(`[CLEANUP] Breakdown:`);
    logger.info(`  - Verified: ${verified.length}`);
    logger.info(`  - Unverified: ${unverified.length}`);

    // Display accounts
    console.log("\n=== INCOMPLETE ACCOUNTS ===");
    incompleteAccounts.forEach((account, index) => {
      console.log(`\n${index + 1}. ${account.email || "No email"}`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Created: ${new Date(account.created_at).toLocaleString()}`);
      console.log(`   Verified: ${account.email_confirmed_at ? "Yes" : "No"}`);
      console.log(`   Name: ${account.full_name || "N/A"}`);
      console.log(`   Onboarding Step: ${account.onboarding_step || "None"}`);
    });

    if (isDryRun) {
      console.log("\n=== DRY RUN MODE ===");
      console.log("This was a dry run. No accounts were deleted.");
      console.log("To actually delete these accounts, run:");
      console.log("  npx tsx scripts/cleanup-incomplete-accounts.ts --delete");
      return;
    }

    if (!shouldDelete) {
      console.log("\n=== NO ACTION TAKEN ===");
      console.log("Use --delete flag to actually delete accounts");
      return;
    }

    // Delete accounts
    console.log("\n=== DELETING ACCOUNTS ===");
    let deletedCount = 0;
    let errorCount = 0;

    for (const account of incompleteAccounts) {
      try {
        const error = await deleteAccount(account.id);
        if (error) {
          logger.error(`[CLEANUP] Failed to delete ${account.email}:`, error);
          errorCount++;
        } else {
          logger.info(`[CLEANUP] Deleted account: ${account.email || account.id}`);
          deletedCount++;
        }
      } catch (err) {
        logger.error(`[CLEANUP] Exception deleting ${account.email}:`, err);
        errorCount++;
      }
    }

    console.log("\n=== CLEANUP COMPLETE ===");
    console.log(`Deleted: ${deletedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total: ${incompleteAccounts.length}`);
  } catch (error) {
    logger.error("[CLEANUP] Fatal error:", error);
    process.exit(1);
  }
}

main();
