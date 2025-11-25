import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';


// GET /api/staff/invitations/[token] - Get invitation details by token
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const req = _request;
    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
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

    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get invitation details using the database function
    const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch invitation" }, { status: 500 });
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

    return NextResponse.json({ invitation });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/staff/invitations/[token] - Accept invitation and create account
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await _request.json();
    const { password, full_name } = body;

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

    const supabase = createAdminClient();

    // Get invitation details
    const { data: invitationData, error: fetchError } = await supabase.rpc(
      "get_invitation_by_token",
      { p_token: token }
    );

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch invitation" }, { status: 500 });
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
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
    }

    if (!acceptResult) {
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
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
      // Empty block
    }

    return NextResponse.json({
      success: true,
      message: "Invitation accepted successfully",
      invitation: updatedInvitation,
    });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
