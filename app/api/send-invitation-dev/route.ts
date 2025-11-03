import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// POST /api/send-invitation-dev - Send invitation email in development mode (Cookie-free)
export async function POST(_request: NextRequest) {
  try {
    const body = await _request.json();
    const { email, venueName, role, invitationLink } = body;

    if (!email || !venueName || !role || !invitationLink) {
      return NextResponse.json(
        {
          error: "email, venueName, role, and invitationLink are required",
        },
        { status: 400 }
      );
    }


    // For development, we'll return success and log the details
    return NextResponse.json({
      success: true,
      message: "Development email logged. Check server logs for details.",
      email,
      invitationLink,
      instructions: "Check server logs for manual email sending instructions",
    });
  } catch (_error) {
    logger.error("[DEV EMAIL] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
