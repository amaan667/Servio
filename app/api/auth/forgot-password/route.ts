import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }

    const supabase = await createClient();

    // Use Supabase's built-in password reset functionality
    // This will send an email automatically with a reset link
    // Supabase will redirect with hash fragments (#access_token=...&type=recovery)
    // IMPORTANT: The redirectTo URL must be whitelisted in Supabase Dashboard > Authentication > URL Configuration
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://servio-production.up.railway.app";
    const redirectUrl = `${appUrl.replace(/\/$/, "")}/reset-password`;

    logger.debug("[FORGOT PASSWORD] Sending reset email:", {
      email: email.trim(),
      redirectUrl,
    });

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      logger.error("[FORGOT PASSWORD] Error sending reset email:", {
        error: error.message,
        email: email.trim(),
      });

      // Don't reveal if email exists or not for security
      // Always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    logger.info("[FORGOT PASSWORD] Password reset email sent:", {
      email: email.trim(),
    });

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (_error) {
    logger.error("[FORGOT PASSWORD] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });

    // Still return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  }
}
