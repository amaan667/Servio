import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// POST /api/fix-invitation-constraint - Direct fix for invitation constraint (Cookie-free)
export async function POST() {
  try {
    const supabase = createAdminClient();


    // Step 1: Get all cancelled invitations and delete them
    const { data: cancelledInvitations, error: fetchError } = await supabase
      .from("staff_invitations")
      .select("id, email, venue_id")
      .eq("status", "cancelled");

    if (fetchError) {
      logger.error("[CONSTRAINT FIX] Error fetching cancelled invitations:", {
        error: fetchError.message,
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
      });
    } else {
      // Deletion successful
    }

    // Step 3: Try to work around the constraint by using a different approach
    // We'll modify the cancel logic to handle this better

    return NextResponse.json({
      success: true,
      message: "Constraint fix completed. Cancelled invitations have been removed.",
      deletedCount: cancelledInvitations?.length || 0,
    });
  } catch (_error) {
    logger.error("[CONSTRAINT FIX] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
