import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    logger.info("[AUTH SIGN-IN] Email/password sign-in attempt:", { email });

    // Create server-side Supabase client that can set cookies
    const supabase = await createServerSupabase();

    // Sign in with password - THIS SETS THE COOKIES!
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      logger.error("[AUTH SIGN-IN] Sign-in error:", { error: signInError.message });
      return NextResponse.json({ error: signInError.message }, { status: 401 });
    }

    if (!data.session) {
      logger.error("[AUTH SIGN-IN] No session returned");
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    logger.info("[AUTH SIGN-IN] ✅ User signed in successfully:", {
      userId: data.session.user.id,
      email: data.session.user.email,
    });

    // Check if user has a venue
    const { data: venues } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("owner_user_id", data.session.user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    // Create response with cookies set manually
    const redirectTo =
      venues && venues.length > 0 && venues[0]
        ? `/dashboard/${venues[0].venue_id}`
        : "/select-plan";

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.session.user.id,
        email: data.session.user.email,
      },
      redirectTo,
    });

    // Get Supabase project ID from URL for cookie names
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";

    if (projectRef && data.session.access_token && data.session.refresh_token) {
      const cookieOptions = {
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: false, // Must be false for Supabase client to read
        maxAge: 60 * 60 * 24 * 7, // 7 days
      };

      // Set the auth token cookies manually
      response.cookies.set(`sb-${projectRef}-auth-token`, data.session.access_token, cookieOptions);
      response.cookies.set(
        `sb-${projectRef}-auth-token-refresh`,
        data.session.refresh_token,
        cookieOptions
      );

      logger.info("[AUTH SIGN-IN] ✅ Cookies set on response", {
        projectRef,
        cookieNames: [`sb-${projectRef}-auth-token`, `sb-${projectRef}-auth-token-refresh`],
      });
    }

    return response;
  } catch (err) {
    logger.error("[AUTH SIGN-IN] Unexpected error:", { error: err });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
