import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { logger } from "@/lib/logger";

// POST /api/staff/invitations/cancel - Cancel an invitation
export async function POST(_request: NextRequest) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await _request.json();
    const { id, venue_id } = body;

    if (!id) {
      return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 });
    }

    if (!venue_id) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    // Verify venue access (must be owner or admin)
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venue_id)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return NextResponse.json({ error: "Forbidden - insufficient permissions" }, { status: 403 });
    }

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

    // Get invitation details - verify it belongs to the venue
    const { data: invitation, error: fetchInvitationError } = await supabase
      .from("staff_invitations")
      .select("venue_id, status")
      .eq("id", id)
      .eq("venue_id", venue_id) // Must match the venue user has access to
      .single();

    if (fetchInvitationError) {
      logger.error("[INVITATION API] Error fetching invitation:", fetchInvitationError);
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    logger.info("✅ [INVITATION CANCEL] User canceling invitation", {
      userId: user.id,
      invitationId: id,
      venueId: venue_id,
    });

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
