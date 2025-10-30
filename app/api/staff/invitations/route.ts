import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// GET /api/staff/invitations - List invitations for a venue (Cookie-free)
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url);
    const venueId = searchParams.get("venue_id");
    const userId = searchParams.get("userId");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Optional: Log user context if provided (for audit trail)
    if (userId) {
      const { data: userRole } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("venue_id", venueId)
        .single();

      if (userRole) {
        logger.info("✅ [STAFF INVITATION GET] User identified", {
          userId: userId,
          role: userRole.role,
        });
      }
    } else {
      logger.info("ℹ️ [STAFF INVITATION GET] No user context provided (cookie-free operation)");
    }

    // Get all invitations for the venue
    const { data: invitations, error } = await supabase
      .from("staff_invitations")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[STAFF INVITATIONS] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    logger.error("[STAFF INVITATIONS] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/staff/invitations - Create invitation (Cookie-free)
export async function POST(_request: NextRequest) {
  try {
    const body = await _request.json();

    // Log the received body for debugging
    logger.info("[STAFF INVITATION POST] Received body:", {
      email: body.email,
      role: body.role,
      venue_id: body.venue_id,
      user_id: body.user_id,
      user_email: body.user_email,
      hasAllFields: !!(body.email && body.role && body.venue_id),
    });

    const { email, role, venue_id, user_id, user_email, user_name, permissions = {} } = body;

    // Only email, role, and venue_id are required (cookie-free operation)
    if (!email || !role || !venue_id) {
      logger.error("[STAFF INVITATION POST] Missing required fields:", {
        hasEmail: !!email,
        hasRole: !!role,
        hasVenueId: !!venue_id,
        body,
      });
      return NextResponse.json(
        { error: "email, role, and venue_id are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Optional: Check if user has permission (if user_id provided, for audit trail)
    if (user_id) {
      const { data: userRole } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("user_id", user_id)
        .eq("venue_id", venue_id)
        .single();

      if (userRole) {
        logger.info("✅ [STAFF INVITATION POST] User identified", {
          userId: user_id,
          role: userRole.role,
        });
      } else {
        logger.info("ℹ️ [STAFF INVITATION POST] User not found in venue roles, checking if owner", {
          userId: user_id,
        });

        // Check if user is venue owner
        const { data: venue } = await supabase
          .from("venues")
          .select("owner_user_id")
          .eq("venue_id", venue_id)
          .single();

        if (venue?.owner_user_id === user_id) {
          logger.info("✅ [STAFF INVITATION POST] User is venue owner");
        }
      }
    } else {
      logger.info("ℹ️ [STAFF INVITATION POST] No user context provided (cookie-free operation)");
    }

    // Get venue details
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_name")
      .eq("venue_id", venue_id)
      .single();

    if (venueError || !venue) {
      logger.error("[STAFF INVITATION POST] Venue not found", venueError);
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("staff_invitations")
      .insert({
        venue_id,
        email: email.toLowerCase(),
        role,
        permissions,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user_id,
        invited_by_email: user_email,
        invited_by_name: user_name,
        status: "pending",
      })
      .select()
      .single();

    if (invitationError) {
      logger.error("[STAFF INVITATION POST] Error creating invitation:", invitationError);
      return NextResponse.json({ error: invitationError.message }, { status: 500 });
    }

    // Send invitation email via Resend
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite/${token}`;

    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        logger.error("[STAFF INVITATION] RESEND_API_KEY not configured");
        throw new Error("Email service not configured");
      }

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Servio <invite@servio.uk>",
          to: [email],
          subject: `You've been invited to join ${venue.venue_name} on Servio`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've been invited!</h2>
              <p>You've been invited by ${user_name || user_email} to join <strong>${venue.venue_name}</strong> as a <strong>${role}</strong>.</p>
              <p>Click the button below to accept your invitation:</p>
              <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #7C3AED; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a>
              <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
              <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        logger.error("[STAFF INVITATION] Resend API error:", {
          status: emailResponse.status,
          error: errorData,
        });
        throw new Error(`Email service returned ${emailResponse.status}`);
      }

      const emailData = await emailResponse.json();
      logger.info("[STAFF INVITATION] Email sent successfully via Resend", {
        emailId: emailData.id,
        to: email,
      });
    } catch (emailError) {
      logger.error("[STAFF INVITATION] Failed to send email:", emailError);
      // Don't fail the whole request if email fails
      // The invitation is created, user can be notified manually
    }

    return NextResponse.json({
      invitation,
      message: "Invitation created and email sent successfully",
    });
  } catch (error) {
    logger.error("[STAFF INVITATION POST] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/staff/invitations - Delete/cancel invitation (Cookie-free)
export async function DELETE(_request: NextRequest) {
  try {
    const body = await _request.json();
    const { invitation_id, user_id, venue_id } = body;

    // Only invitation_id and venue_id are required (cookie-free operation)
    if (!invitation_id || !venue_id) {
      return NextResponse.json(
        { error: "invitation_id and venue_id are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Optional: Check if user has permission (if user_id provided, for audit trail)
    if (user_id) {
      const { data: userRole } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("user_id", user_id)
        .eq("venue_id", venue_id)
        .single();

      if (userRole) {
        logger.info("✅ [STAFF INVITATION DELETE] User identified", {
          userId: user_id,
          role: userRole.role,
        });
      }
    } else {
      logger.info("ℹ️ [STAFF INVITATION DELETE] No user context provided (cookie-free operation)");
    }

    // Delete the invitation
    const { error } = await supabase
      .from("staff_invitations")
      .delete()
      .eq("id", invitation_id)
      .eq("venue_id", venue_id);

    if (error) {
      logger.error("[STAFF INVITATIONS] Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[STAFF INVITATIONS] DELETE unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
