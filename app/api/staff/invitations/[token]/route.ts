import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from "@/lib/logger";

// GET /api/staff/invitations/[token] - Get invitation details by token
export const GET = withUnifiedAuth(
  async (req: NextRequest, context, routeParams?: { params?: Promise<Record<string, string>> }) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      let token: string | null = null;
      if (routeParams?.params) {
        const params = await routeParams.params;
        token = params?.token as string | undefined || null;
      }

      // STEP 4: Validate inputs
      if (!token) {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)
      // Note: Invitation tokens may be accessed by unauthenticated users, but we require auth for security

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Get invitation details using the database function
      const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

      if (error) {
        logger.error("[INVITATIONS GET] Error fetching invitation:", {
          error: error.message,
          token,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch invitation",
            message: process.env.NODE_ENV === "development" ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Invitation not found or expired" }, { status: 404 });
      }

      const invitation = data[0];

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
      }

      // Check if invitation is already accepted
      if (invitation.status !== "pending") {
        return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 410 });
      }

      // STEP 7: Return success response
      return NextResponse.json({ invitation });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[INVITATIONS GET] Unexpected error:", {
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
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract token from URL params
    extractVenueId: async (_req, routeParams) => {
      // Invitations don't require venue access - token is in URL
      return null;
    },
  }
);

// POST /api/staff/invitations/[token] - Accept invitation and create account
export const POST = withUnifiedAuth(
  async (req: NextRequest, context, routeParams?: { params?: Promise<Record<string, string>> }) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.AUTH);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      // Note: For invitation acceptance, user may not be authenticated yet
      // STEP 3: Parse request
      let token: string | null = null;
      if (routeParams?.params) {
        const params = await routeParams.params;
        token = params?.token as string | undefined || null;
      }
      const body = await req.json();
      const { password, full_name } = body;

      // STEP 4: Validate inputs
      if (!token) {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
      }

      if (!password || !full_name) {
        return NextResponse.json(
          {
            error: "password and full_name are required",
          },
          { status: 400 }
        );
      }

      // STEP 5: Security - Auth may not be required for accepting invitations
      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Get invitation details
      const { data: invitationData, error: fetchError } = await supabase.rpc(
        "get_invitation_by_token",
        { p_token: token }
      );

      if (fetchError) {
        logger.error("[INVITATIONS POST] Error fetching invitation:", {
          error: fetchError.message,
          token,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch invitation",
            message: process.env.NODE_ENV === "development" ? fetchError.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      if (!invitationData || invitationData.length === 0) {
        return NextResponse.json({ error: "Invitation not found or expired" }, { status: 404 });
      }

      const invitation = invitationData[0];

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
      }

      // Check if invitation is already accepted
      if (invitation.status !== "pending") {
        return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 410 });
      }

      // Try to create new user account
      // If user already exists, we'll get an error and handle it
      let userId: string;

      // Use admin client to create user
      const adminClient = createAdminClient();
      const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password,
        user_metadata: {
          full_name,
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
          return NextResponse.json(
            {
              error:
                "An account with this email already exists. Please sign in to your existing account and contact the person who invited you to resend the invitation.",
            },
            { status: 409 }
          );
        }

        // Check for specific Supabase errors
        if (signUpError.message?.includes("User not allowed")) {
          return NextResponse.json(
            {
              error:
                "Account creation is not allowed. Please contact the venue owner for assistance.",
            },
            { status: 403 }
          );
        }

        // Return the actual error message
        logger.error("[INVITATIONS POST] Error creating user:", {
          error: signUpError.message,
          token,
        });
        return NextResponse.json(
          {
            error: "Failed to create account: " + (signUpError.message || "Unknown error"),
            details: signUpError,
          },
          { status: 500 }
        );
      }

      userId = newUser.user.id;

      // Accept the invitation using the database function
      const { data: acceptResult, error: acceptError } = await supabase.rpc("accept_invitation", {
        p_token: token,
        p_user_id: userId,
      });

      if (acceptError) {
        logger.error("[INVITATIONS POST] Error accepting invitation:", {
          error: acceptError.message,
          token,
          userId,
        });
        return NextResponse.json(
          {
            error: "Failed to accept invitation",
            message: process.env.NODE_ENV === "development" ? acceptError.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      if (!acceptResult) {
        return NextResponse.json(
          {
            error: "Failed to accept invitation",
            message: "Invitation acceptance returned no result",
          },
          { status: 500 }
        );
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
        logger.warn("[INVITATIONS POST] Error fetching updated invitation:", {
          error: updateError.message,
          token,
        });
        // Continue anyway - invitation was accepted
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Invitation accepted successfully",
        invitation: updatedInvitation,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[INVITATIONS POST] Unexpected error:", {
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
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract token from URL params - no venue required
    extractVenueId: async () => null,
  }
);
