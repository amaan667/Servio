import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

// GET /api/staff/invitations - List invitations for a venue (Requires auth)
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit();
    }

      // Get venueId from context
      const venueId = context.venueId;
      
      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // Fetch invitations
      const supabase = createAdminClient();
      const { data: invitations, error: fetchError } = await supabase
        .from("staff_invitations")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        logger.error("[STAFF INVITATIONS] Error fetching invitations:", {
          error: fetchError.message,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database("Failed to fetch invitations");
      }

      return success({ invitations: invitations || [] });
    } catch (error) {
      logger.error("[STAFF INVITATIONS] Unexpected error:", error);
      return apiErrors.internal('Internal server error');
    }
  }
);

// POST /api/staff/invitations - Create invitation (Requires auth)
export async function POST(_request: NextRequest) {
  try {
    // Get authenticated user from cookies using getUserSafe
    const { getUserSafe } = await import("@/utils/getUserSafe");
    const user = await getUserSafe();

    if (!user) {
      logger.warn("[STAFF INVITATION POST] Unauthorized - no user session");
      return apiErrors.unauthorized('Unauthorized');
    }

    const body = await _request.json();

    // Log the received body for debugging
    logger.info("[STAFF INVITATION POST] Received body:", {
      email: body.email,
      role: body.role,
      venue_id: body.venue_id,
      userId: user.id,
      hasAllFields: !!(body.email && body.role && body.venue_id),
    });

    const { email, role, venue_id, permissions = {} } = body;

    if (!email || !role || !venue_id) {
      logger.error("[STAFF INVITATION POST] Missing required fields:", {
        hasEmail: !!email,
        hasRole: !!role,
        hasVenueId: !!venue_id,
      });
      return apiErrors.badRequest("email, role, and venue_id are required");
    }

    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Check if authenticated user has permission (either venue owner or has owner/manager role)
    // First check if user is the venue owner and get venue details
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("owner_user_id, venue_name")
      .eq("venue_id", venue_id)
      .single();

    if (venueError || !venue) {
      logger.error("[STAFF INVITATION POST] Venue not found", venueError);
      return apiErrors.notFound('Venue not found');
    }

    const isVenueOwner = venue.owner_user_id === user.id;

    // If not venue owner, check if they have owner or manager role in user_venue_roles
    let hasPermission = false;
    if (!isVenueOwner) {
      const { data: userRole } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("venue_id", venue_id)
        .single();

      hasPermission = userRole?.role === "owner" || userRole?.role === "manager";
    }

    if (!isVenueOwner && !hasPermission) {
      logger.warn("[STAFF INVITATION POST] User doesn't have permission", {
        userId: user.id,
        venueId: venue_id,
        isVenueOwner,
        hasPermission,
      });
      return apiErrors.forbidden("Forbidden - Only owners and managers can send invitations");
    }

    logger.info("✅ [STAFF INVITATION POST] User has permission", {
      userId: user.id,
      isVenueOwner,
      hasPermission,
    });

    // Check tier limits for staff count
    const { checkLimit } = await import("@/lib/tier-restrictions");

    // Count current staff (active user_venue_roles)
    const { count: currentStaffCount } = await supabase
      .from("user_venue_roles")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue_id);

    const staffCount = currentStaffCount || 0;

    // Check tier limit
    const limitCheck = await checkLimit(user.id, "maxStaff", staffCount);
    if (!limitCheck.allowed) {
      logger.warn("[STAFF INVITATION POST] Staff limit reached", {
        userId: user.id,
        currentCount: staffCount,
        limit: limitCheck.limit,
        tier: limitCheck.currentTier,
      });
      return apiErrors.forbidden(
        `Staff limit reached. You have ${staffCount}/${limitCheck.limit} staff members. Upgrade to ${limitCheck.limit === 3 ? "Pro" : "Enterprise"} tier for more staff.`,
        {
          limitReached: true,
          currentCount: staffCount,
          limit: limitCheck.limit,
          tier: limitCheck.currentTier,
        }
      );
    }

    // Check if a pending invitation already exists for this email/venue
    const { data: existingInvitation } = await supabase
      .from("staff_invitations")
      .select("id, status, email")
      .eq("venue_id", venue_id)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    // If a pending invitation exists, delete it first (to allow resending)
    if (existingInvitation) {
      logger.info("[STAFF INVITATION POST] Deleting existing pending invitation", {
        invitationId: existingInvitation.id,
        email: existingInvitation.email,
      });

      const { error: deleteError } = await supabase
        .from("staff_invitations")
        .delete()
        .eq("id", existingInvitation.id);

      if (deleteError) {
        logger.error("[STAFF INVITATION POST] Error deleting old invitation:", deleteError);
        return apiErrors.internal("Failed to resend invitation. Please try again.");
      }
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invitation using authenticated user's info
    // Note: invited_by_email and invited_by_name are computed by get_invitation_by_token function
    // They are NOT actual table columns - only invited_by (UUID) is stored
    const { data: invitation, error: invitationError } = await supabase
      .from("staff_invitations")
      .insert({
        venue_id,
        email: email.toLowerCase(),
        role: role.toLowerCase(), // Database constraint requires lowercase
        permissions,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id, // Only store UUID - email/name are fetched via JOIN
        status: "pending",
      })
      .select()
      .single();

    if (invitationError) {
      logger.error("[STAFF INVITATION POST] Error creating invitation:", invitationError);

      // Handle duplicate key error with a friendly message
      if (
        invitationError.message?.includes("duplicate key") ||
        invitationError.message?.includes("unique constraint")
      ) {
        return apiErrors.conflict(
          "An invitation for this email already exists. Please wait a moment and try again."
        );
      }

      return apiErrors.internal('Internal server error');
    }

    // Send invitation email via Resend
    const inviteLink = `${env('NEXT_PUBLIC_APP_URL')}/accept-invite/${token}`;

    try {
      const resendApiKey = env('RESEND_API_KEY');
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
              <p>You've been invited to join <strong>${venue.venue_name}</strong> as a <strong>${role}</strong>.</p>
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
      // Email sent successfully
      return success({
        invitation,
        message: "Invitation created and email sent successfully",
        emailSent: true,
      });
    } catch (emailError) {
      logger.error("[STAFF INVITATION] Failed to send email", {
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
      // Don't fail the whole request if email fails
      // The invitation is created, user can be notified manually
      return success({
        invitation,
        message: "Invitation created but email failed to send",
        emailSent: false,
      });
    }
  } catch (error) {
    logger.error("[STAFF INVITATION POST] Unexpected error:", error);
    return apiErrors.internal('Internal server error');
  }
}

// DELETE /api/staff/invitations - Delete/cancel invitation (Requires auth)
export async function DELETE(_request: NextRequest) {
  try {
    // Get authenticated user from cookies
    const { getUserSafe } = await import("@/utils/getUserSafe");
    const user = await getUserSafe();

    if (!user) {
      logger.warn("[STAFF INVITATIONS DELETE] Unauthorized - no user session");
      return apiErrors.unauthorized('Unauthorized');
    }

    const body = await _request.json();
    const { invitation_id, venue_id } = body;

    if (!invitation_id || !venue_id) {
      return apiErrors.badRequest("invitation_id and venue_id are required");
    }

    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Check if user has permission (owner or manager)
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", venue_id)
      .single();

    const isVenueOwner = venue?.owner_user_id === user.id;

    let hasPermission = false;
    if (!isVenueOwner) {
      const { data: userRole } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("venue_id", venue_id)
        .single();

      hasPermission = userRole?.role === "owner" || userRole?.role === "manager";
    }

    if (!isVenueOwner && !hasPermission) {
      return apiErrors.forbidden('Forbidden');
    }

    // Delete the invitation
    const { error } = await supabase
      .from("staff_invitations")
      .delete()
      .eq("id", invitation_id)
      .eq("venue_id", venue_id);

    if (error) {
      logger.error("[STAFF INVITATIONS] Delete error:", error);
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return success({});
  } catch (error) {
    logger.error("[STAFF INVITATIONS] DELETE unexpected error:", error);
    return apiErrors.internal('Internal server error');
  }
}
