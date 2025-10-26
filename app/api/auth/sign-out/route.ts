import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST() {
  try {
    // Simply return success - let the client handle the actual sign-out
    const response = NextResponse.json({ ok: true });

    // Clear auth cookies by setting them to expire immediately
    const cookieOptions = {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    response.cookies.set("sb-access-token", "", cookieOptions);
    response.cookies.set("sb-refresh-token", "", cookieOptions);
    response.cookies.set("supabase-auth-token", "", cookieOptions);

    return response;
  } catch (_error) {
    logger._error("[AUTH] Sign-out error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: true }); // Always return success to avoid client errors
  }
}
