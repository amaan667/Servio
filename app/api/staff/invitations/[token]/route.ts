import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

// Validation schemas
const acceptInvitationSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1).max(100),
});

const tokenParamSchema = z.object({
  token: z.string().min(1),
});

// GET /api/staff/invitations/[token] - Get invitation details by token
export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Validate route parameters
    const token = context.params?.token;

    if (!token) {
      return apiErrors.badRequest("Token is required");
    }

    // Business logic
    const supabase = createAdminClient();

    // Get invitation details using the database function
    const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

    if (error) {
      return apiErrors.database("Failed to fetch invitation");
    }

    if (!data || data.length === 0) {
      return apiErrors.notFound("Invitation not found or expired");
    }

    const invitation = data[0];

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return apiErrors.badRequest("Invitation has expired", { status: 410 });
    }

    // Check if invitation is already accepted
    if (invitation.status !== "pending") {
      return apiErrors.badRequest("Invitation is no longer valid", { status: 410 });
    }

    return success({ invitation });
  },
  {
    requireAuth: false, // Invitations can be accessed without auth
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
    venueIdSource: "params",
  }
);

// POST /api/staff/invitations/[token] - Accept invitation and create account
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Validate route parameters and body
    const token = context.params?.token;

    if (!token) {
      return apiErrors.badRequest("Token is required");
    }

    const { body } = context;

    // Business logic
    const supabase = createAdminClient();

      // Get invitation details
      const { data: invitationData, error: fetchError } = await supabase.rpc(
        "get_invitation_by_token",
        { p_token: token }
      );

      if (fetchError) {
        return apiErrors.database("Failed to fetch invitation");
      }

      if (!invitationData || invitationData.length === 0) {
        return apiErrors.notFound("Invitation not found or expired");
      }

      const invitation = invitationData[0];

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return apiErrors.badRequest("Invitation has expired", { status: 410 });
      }

      // Check if invitation is already accepted
      if (invitation.status !== "pending") {
        return apiErrors.badRequest("Invitation is no longer valid", { status: 410 });
      }

      // Try to create new user account
      const adminClient = createAdminClient();
      const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password: body.password,
        user_metadata: {
          full_name: body.full_name,
          invited_by: invitation.invited_by_name,
        },
        email_confirm: true, // Auto-confirm since they're invited
      });

      if (signUpError) {
        // Check if the error is because user already exists
        if (
          signUpError.message?.includes("already registered") ||
          signUpError.message?.includes("already exists")
        ) {
          return apiErrors.conflict(
            "An account with this email already exists. Please sign in to your existing account and contact the person who invited you to resend the invitation."
          );
        }

        // Check for specific Supabase errors
        if (signUpError.message?.includes("User not allowed")) {
          return apiErrors.forbidden(
            "Account creation is not allowed. Please contact the venue owner for assistance."
          );
        }

        return apiErrors.internal("Failed to create account");
      }

      if (!newUser?.user) {
        return apiErrors.internal("User creation failed - no user returned");
      }

      const userId = newUser.user.id;

      // Accept the invitation using the database function
      const { data: acceptResult, error: acceptError } = await supabase.rpc("accept_invitation", {
        p_token: token,
        p_user_id: userId,
      });

      if (acceptError) {
        return apiErrors.database("Failed to accept invitation");
      }

      if (!acceptResult) {
        return apiErrors.internal("Invitation acceptance returned no result");
      }

      // Get the updated invitation details
      const { data: updatedInvitation, error: updateError } = await supabase
        .from("staff_invitations")
        .select(
          `
          *,
          venues!inner(venue_name),
          organizations(name)
        `
        )
        .eq("token", token)
        .single();

      if (updateError) {
        // Continue anyway - invitation was accepted
      }

      return success({
        message: "Invitation accepted successfully",
        invitation: updatedInvitation,
      });
  },
  {
    schema: acceptInvitationSchema,
    requireAuth: false, // Invitations can be accepted without auth
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.AUTH,
    venueIdSource: "params",
  }
);
