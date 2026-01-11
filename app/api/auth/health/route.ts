import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import { env, getNodeEnv } from "@/lib/env";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabase();

    // Check for auth cookies
    const authCookies = cookieStore
      .getAll()
      .filter((cookie) => cookie.name.includes("sb-") || cookie.name.includes("auth"));

    // Try to get session
    let sessionStatus = "unknown";
    let sessionError = null;
    let userId = null;

    try {
      // Use getUser() for secure authentication check
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        sessionStatus = "error";
        sessionError = error.message;
      } else if (user) {
        sessionStatus = "active";
        userId = user.id;
      } else {
        sessionStatus = "none";
      }
    } catch (_err) {
      sessionStatus = "exception";
      sessionError = _err instanceof Error ? _err.message : "Unknown error";
    }

    return NextResponse.json({

        userId: userId?.substring(0, 8) + "...",
        sessionError,

        authCookies: authCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
      },

      },

      },

  } catch (_error) {
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
