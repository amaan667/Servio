import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { isProduction } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export async function POST() {
  try {
    const supabase = await createServerSupabase();

    // SECURE: Use getUser() instead of getSession() for authentication check
    await supabase.auth.getUser();

    // Perform the signout
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("[SIGNOUT API] Supabase signout error", { error: error.message });
      return apiErrors.internal(error.message);
    }

    // Create a response that clears cookies
    const response = success({});

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
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[SIGNOUT API] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal(errorMessage);
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}
