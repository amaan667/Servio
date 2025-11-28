import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';

export async function POST() {
  try {
    const supabase = await createServerSupabase();

    // SECURE: Use getUser() instead of getSession() for authentication check
    await supabase.auth.getSession();

    // Perform the signout
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("[SIGNOUT API] Supabase signout error:", { error: error.message });
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // Create a response that clears cookies
    const response = NextResponse.json({ ok: true });

    // Explicitly clear auth cookies to ensure they're removed
    const authCookieNames = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase.auth.token",
      "supabase-auth-token",
    ];

    authCookieNames.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure: isProduction(),
        httpOnly: false,
      });
    });

    return response;
  } catch (_error) {
    logger.error("[SIGNOUT API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Internal server _error",
      },
      { status: 500 }
    );
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}
