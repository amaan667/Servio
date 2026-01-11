import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateParams, validateBody } from "@/lib/api/validation-schemas";

// Validation schemas
const acceptInvitationSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1).max(100),
});

const tokenParamSchema = z.object({
  token: z.string().min(1),
});

// GET /api/staff/invitations/[token] - Get invitation details by token
export const GET = withUnifiedAuth(
  async (req: NextRequest, _context, routeParams?: { params?: Promise<Record<string, string>> }) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate route parameters
      let token: string | null = null;
      if (routeParams?.params) {
        const params = await routeParams.params;
        const validated = validateParams(tokenParamSchema, params);
        token = validated.token;
      }

      if (!token) {
        return apiErrors.badRequest("Token is required");
      }

      // STEP 3: Business logic
      const supabase = createAdminClient();

      // Get invitation details using the database function
      const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

      if (error) {

        return apiErrors.database(
          "Failed to fetch invitation",
          isDevelopment() ? error.message : undefined
        );
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

      // STEP 4: Return success response
      return success({ invitation });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract token from URL params
    extractVenueId: async () => {
      // Invitations don't require venue access - token is in URL
      return null;
    },
  }
);

// POST /api/staff/invitations/[token] - Accept invitation and create account
export const POST = withUnifiedAuth(
  async (req: NextRequest, _context, routeParams?: { params?: Promise<Record<string, string>> }) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.AUTH);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate route parameters and body
      let token: string | null = null;
      if (routeParams?.params) {
        const params = await routeParams.params;
        const validated = validateParams(tokenParamSchema, params);
        token = validated.token;
      }

      if (!token) {
        return apiErrors.badRequest("Token is required");
      }

      const body = await validateBody(acceptInvitationSchema, await req.json());

      // STEP 3: Business logic
      const supabase = createAdminClient();

      // Get invitation details
      const { data: invitationData, error: fetchError } = await supabase.rpc(
        "get_invitation_by_token",
        { p_token: token }
      );

      if (fetchError) {

        return apiErrors.database(
          "Failed to fetch invitation",
          isDevelopment() ? fetchError.message : undefined
        );
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

        return apiErrors.internal(
          "Failed to create account",
          isDevelopment() ? signUpError : undefined
        );
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

        return apiErrors.database(
          "Failed to accept invitation",
          isDevelopment() ? acceptError.message : undefined
        );
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

      // STEP 4: Return success response
      return success({
        message: "Invitation accepted successfully",
        invitation: updatedInvitation,
      });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract token from URL params - no venue required
    extractVenueId: async () => null,
  }
);
