import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadOnly } from "@/lib/supabase";

/**
 * API route for Menu Builder CTA button redirect
 * - If user is signed in: redirects to their venue's menu-management page
 * - If user is not signed in: redirects to /select-plan page
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseReadOnly();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Not signed in - redirect to select-plan page
      return NextResponse.redirect(new URL("/select-plan", req.url));
    }

    // User is signed in - find their venue
    const { data: venues } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (venues?.venue_id) {
      // User has a venue - redirect to menu-management
      return NextResponse.redirect(
        new URL(`/dashboard/${venues.venue_id}/menu-management`, req.url)
      );
    }

    // User is signed in but has no venue - redirect to select-plan
    return NextResponse.redirect(new URL("/select-plan", req.url));
  } catch (error) {
    // On error, redirect to select-plan as fallback
    return NextResponse.redirect(new URL("/select-plan", req.url));
  }
}


