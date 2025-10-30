import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const error = requestUrl.searchParams.get("error");

  if (error) {
    // OAuth error - redirect to sign-in with error message
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (code) {
    try {
      // Create server-side Supabase client that can set cookies
      const supabase = await createServerSupabase();

      // Exchange code for session - THIS SETS THE COOKIES!
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

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

        // Check if user has a venue
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", data.session.user.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (venues && venues.length > 0 && venues[0]) {
          // Redirect to their dashboard
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
