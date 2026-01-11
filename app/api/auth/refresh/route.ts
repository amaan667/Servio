import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = await createServerSupabase();

    // SECURE: Use getUser() instead of getSession() for authentication check
    // This authenticates the data by contacting the Supabase Auth server
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {

      return NextResponse.json(
        {
          ok: false,
          error: userError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "No authenticated user",
        },
        { status: 401 }
      );
    }

    // Get session for expires_at if needed
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError && !sessionError.message?.includes("refresh_token_not_found")) {
      // Session error logged silently
    }

    return NextResponse.json({
      ok: true,
      session: {
        user: user, // Use authenticated user from getUser()
        expires_at: session?.expires_at || null,
      },
    });
  } catch (_error) {

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
