import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "access_token and refresh_token are required" },
        { status: 400 }
      );
    }

    logger.info("[AUTH SYNC] Syncing session to server cookies");

    // Create server-side Supabase client
    const supabase = await createServerSupabase();

    // Set the session using the tokens from client
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      logger.error("[AUTH SYNC] Failed to set session:", { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info("[AUTH SYNC] ✅ Session synced successfully", {
      userId: data.session?.user?.id,
      email: data.session?.user?.email,
    });

    // Verify cookies were set
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter((c) => c.name.includes("sb-"));

    logger.info("[AUTH SYNC] Cookies after sync:", {
      totalCookies: allCookies.length,
      authCookiesCount: authCookies.length,
      authCookieNames: authCookies.map((c) => c.name).join(", "),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[AUTH SYNC] Unexpected error:", { error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
