import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Set session from client-side auth
 * This endpoint allows client-side to sync session to server cookies
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "access_token and refresh_token are required" },
        { status: 400 }
      );
    }

    logger.info("[AUTH SET-SESSION] Setting session from client tokens");

    // Create server-side Supabase client
    const supabase = await createServerSupabase();

    // Use setSession to properly set the session with the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      logger.error("[AUTH SET-SESSION] Error setting session:", { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.session) {
      logger.error("[AUTH SET-SESSION] No session returned");
      return NextResponse.json({ error: "Failed to set session" }, { status: 500 });
    }

    logger.info("[AUTH SET-SESSION] ✅ Session set successfully", {
      userId: data.session.user.id,
      email: data.session.user.email,
    });

    // The cookies should be set automatically by the Supabase client
    // But let's also set them manually to ensure they're there
    const response = NextResponse.json({ success: true });

    // Get Supabase project ID from URL for cookie names
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";

    if (projectRef) {
      const cookieOptions = {
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: false, // Must be false for Supabase client to read
        maxAge: 60 * 60 * 24 * 7, // 7 days
      };

      // Set the auth token cookies manually as backup
      response.cookies.set(`sb-${projectRef}-auth-token`, access_token, cookieOptions);
      response.cookies.set(`sb-${projectRef}-auth-token-refresh`, refresh_token, cookieOptions);

      logger.info("[AUTH SET-SESSION] ✅ Cookies also set manually on response", {
        projectRef,
        cookieNames: [`sb-${projectRef}-auth-token`, `sb-${projectRef}-auth-token-refresh`],
      });
    }

    return response;
  } catch (err) {
    logger.error("[AUTH SET-SESSION] Unexpected error:", { error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
