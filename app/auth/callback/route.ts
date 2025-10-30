import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const error = requestUrl.searchParams.get("error");

  // Log incoming cookies
  const { cookies: incomingCookies } = await import("next/headers");
  const incomingCookieStore = await incomingCookies();
  const incomingCookiesList = incomingCookieStore.getAll();

  logger.info("[AUTH CALLBACK] ========== CALLBACK START ==========");
  logger.info("[AUTH CALLBACK] URL:", { url: request.url });
  logger.info("[AUTH CALLBACK] Parameters:", { hasCode: !!code, hasError: !!error });
  logger.info("[AUTH CALLBACK] Incoming cookies:", {
    count: incomingCookiesList.length,
    names: incomingCookiesList.map((c) => c.name).join(", "),
    authCookies:
      incomingCookiesList
        .filter((c) => c.name.includes("sb-"))
        .map((c) => c.name)
        .join(", ") || "NONE",
  });

  if (error) {
    logger.error("[AUTH CALLBACK] OAuth error received:", { error });
    // OAuth error - redirect to sign-in with error message
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (code) {
    try {
      logger.info("[AUTH CALLBACK] Creating server Supabase client...");
      // Create server-side Supabase client that can set cookies
      const supabase = await createServerSupabase();

      logger.info("[AUTH CALLBACK] Exchanging code for session...");
      // Exchange code for session - THIS SETS THE COOKIES!
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      logger.info("[AUTH CALLBACK] Exchange result:", {
        hasSession: !!data?.session,
        hasUser: !!data?.session?.user,
        userId: data?.session?.user?.id,
        email: data?.session?.user?.email,
        error: exchangeError?.message,
      });

      if (exchangeError) {
        logger.error("[AUTH CALLBACK] Exchange error:", { error: exchangeError });
        return NextResponse.redirect(
          new URL(
            `/sign-in?error=${encodeURIComponent("Authentication failed. Please try again.")}`,
            request.url
          )
        );
      }

      if (data?.session) {
        logger.info("[AUTH CALLBACK] ✅ Session created successfully", {
          userId: data.session.user.id,
          email: data.session.user.email,
        });

        // Check cookies that were set
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const authCookies = allCookies.filter(
          (c) => c.name.includes("sb-") || c.name.includes("auth")
        );

        logger.info("[AUTH CALLBACK] Cookies after exchange:", {
          totalCookies: allCookies.length,
          authCookiesCount: authCookies.length,
          authCookieNames: authCookies.map((c) => c.name).join(", "),
          allCookieNames: allCookies.map((c) => c.name).join(", "),
        });

        // Check if user has a venue
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", data.session.user.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (venues && venues.length > 0 && venues[0]) {
          // Redirect to their dashboard
          logger.info("[AUTH CALLBACK] Redirecting to dashboard:", { venueId: venues[0].venue_id });
          return NextResponse.redirect(new URL(`/dashboard/${venues[0].venue_id}`, request.url));
        }

        // Check if they're staff at any venue
        const { data: staffRoles } = await supabase
          .from("user_venue_roles")
          .select("venue_id")
          .eq("user_id", data.session.user.id)
          .limit(1);

        if (staffRoles && staffRoles.length > 0 && staffRoles[0]?.venue_id) {
          // Redirect to their staff dashboard
          return NextResponse.redirect(
            new URL(`/dashboard/${staffRoles[0].venue_id}`, request.url)
          );
        }

        // New user - redirect to select plan
        logger.info("[AUTH CALLBACK] New user - redirecting to select plan");
        return NextResponse.redirect(new URL("/select-plan", request.url));
      }
    } catch (err) {
      logger.error("[AUTH CALLBACK] Unexpected error:", { error: err });
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent("An unexpected error occurred")}`, request.url)
      );
    }
  }

  // No code provided - redirect to sign-in
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
