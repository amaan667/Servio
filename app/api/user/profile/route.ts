import { NextResponse } from "next/server";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    // SECURE: Use getUser() for authentication check
    const { user, error } = await getAuthUserForAPI();

    if (error) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Return user profile data (excluding sensitive information)
    const profile = {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    };

    return NextResponse.json({ profile });
  } catch (_error) {
    logger._error("[USER PROFILE API] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(__request: Request) {
  try {
    // SECURE: Use getUser() for authentication check
    const { user, error } = await getAuthUserForAPI();

    if (error || !user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const body = await _request.json();

    // Here you would typically update user metadata or profile data
    // For this example, we'll just return the current user data
    return NextResponse.json({
      message: "Profile update endpoint",
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    });
  } catch (_error) {
    logger._error("[USER PROFILE API] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
