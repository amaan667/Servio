import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getUserSafe } from "@/utils/getUserSafe";
import { logger } from "@/lib/logger";

// POST /api/staff/invitations/cancel - Cancel an invitation
export async function POST(_request: NextRequest) {
  try {
    const user = await getUserSafe();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await _request.json();
    const { id } = body;

    logger.debug("[INVITATION API] Cancel request received:", { data: { id, user: user.id } });

    if (!id) {
      return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if staff_invitations table exists
    try {
      await supabase.from("staff_invitations").select("id").limit(1);
    } catch (tableError: unknown) {
      const errorMessage = tableError instanceof Error ? tableError.message : "Unknown error";
      const errorCode =
        tableError && typeof tableError === "object" && "code" in tableError
          ? String(tableError.code)
          : undefined;

      if (
        errorCode === "PGRST116" ||
        errorMessage?.includes('relation "staff_invitations" does not exist')
      ) {
        logger.debug("[INVITATION API] staff_invitations table does not exist");
        return NextResponse.json(
          {
            error: "Staff invitation system not set up. Please run the database migration first.",
          },
          { status: 503 }
        );
      } else {
        logger.error("[INVITATION API] Unexpected table error:", { error: errorMessage });
        return NextResponse.json(
          {
            error: "Database error. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    // Get invitation details to check permissions
    const { data: invitation, error: fetchInvitationError } = await supabase
      .from("staff_invitations")
      .select("venue_id, status")
      .eq("id", id)
      .single();

    if (fetchInvitationError) {
      logger.error("[INVITATION API] Error fetching invitation:", fetchInvitationError);
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Check if user has permission to cancel invitations for this venue
    const { data: userRole } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("venue_id", invitation.venue_id)
      .single();

    // If no role found, check if user is the venue owner
    let hasPermission = false;
    if (userRole && ["owner", "manager"].includes(userRole.role)) {
      hasPermission = true;
    } else {
      // Check if user is the venue owner
      const { data: venue } = await supabase
        .from("venues")
        .select("owner_user_id")
        .eq("venue_id", invitation.venue_id)
        .single();

      if (venue && venue.owner_user_id === user.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Check if invitation can be cancelled
    if (invitation.status !== "pending") {
      return NextResponse.json(
        {
          error: "Only pending invitations can be cancelled",
        },
        { status: 400 }
      );
    }

    // Simple approach: just mark as cancelled and let the UI filter it out
    // This avoids all constraint issues
    const { error: updateError } = await supabase
      .from("staff_invitations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      logger.error("[INVITATION API] Error updating invitation:", updateError);
      return NextResponse.json(
        {
          error: "Failed to cancel invitation",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    logger.debug("[INVITATION API] Invitation marked as cancelled");

    logger.debug("[INVITATION API] Invitation cancelled and removed successfully:", id);

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled successfully",
    });
  } catch (_error) {
    logger.error("[INVITATION API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
