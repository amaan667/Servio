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

    // The cookies are automatically set by the Supabase SSR client via setSession
    // Don't manually override them - let Supabase handle the chunking properly
    const response = NextResponse.json({ success: true });


    return response;
  } catch (err) {
    logger.error("[AUTH SET-SESSION] Unexpected error:", { error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
