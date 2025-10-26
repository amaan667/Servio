import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { session, error } = await getSession();

    if (error) {
      logger.error("[REFRESH API] Error getting session:", { error });
      return NextResponse.json(
        {
          ok: false,
          error,
        },
        { status: 401 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "No session available",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      session: {
        user: session.user,
        expires_at: session.expires_at,
      },
    });
  } catch (_error) {
    logger.error("[REFRESH API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
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
