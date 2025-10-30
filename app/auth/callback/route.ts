import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const error = requestUrl.searchParams.get("error");

  console.log("[AUTH CALLBACK] ========== CALLBACK START ==========");
  console.log("[AUTH CALLBACK] URL:", request.url);
  console.log("[AUTH CALLBACK] Has code:", !!code);
  console.log("[AUTH CALLBACK] Has error:", !!error);

  if (error) {
    console.log("[AUTH CALLBACK] OAuth error received:", error);
    // OAuth error - redirect to sign-in with error message
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (code) {
    try {
      console.log("[AUTH CALLBACK] Creating server Supabase client...");
      // Create server-side Supabase client that can set cookies
      const supabase = await createServerSupabase();

      console.log("[AUTH CALLBACK] Exchanging code for session...");
      // Exchange code for session - THIS SETS THE COOKIES!
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      console.log("[AUTH CALLBACK] Exchange result:", {
        hasSession: !!data?.session,
        hasUser: !!data?.session?.user,
        error: exchangeError?.message,
      });

      if (exchangeError) {
        console.error("[AUTH CALLBACK] Exchange error:", exchangeError);
        return NextResponse.redirect(
          new URL(
            `/sign-in?error=${encodeURIComponent("Authentication failed. Please try again.")}`,
            request.url
          )
        );
      }

      if (data?.session) {
        console.log(
          "[AUTH CALLBACK] ✅ Session created successfully for:",
          data.session.user.email
        );

        // Force a redirect response that will include the set-cookie headers
        const response = NextResponse.redirect(new URL("/dashboard", request.url));

        console.log("[AUTH CALLBACK] Checking cookies that were set...");
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        console.log("[AUTH CALLBACK] Total cookies after exchange:", allCookies.length);
        console.log("[AUTH CALLBACK] Cookie names:", allCookies.map((c) => c.name).join(", "));

        // Check if user has a venue
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", data.session.user.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (venues && venues.length > 0 && venues[0]) {
          // Redirect to their dashboard
          console.log("[AUTH CALLBACK] Redirecting to dashboard:", venues[0].venue_id);
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
        return NextResponse.redirect(new URL("/select-plan", request.url));
      }
    } catch (err) {
      console.error("[AUTH CALLBACK] Unexpected error:", err);
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent("An unexpected error occurred")}`, request.url)
      );
    }
  }

  // No code provided - redirect to sign-in
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
