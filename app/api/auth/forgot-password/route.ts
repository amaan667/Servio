import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {
    logger.info(`[FORGOT PASSWORD API] ${requestId} - Request received`, {
      timestamp: new Date().toISOString(),
      headers: {
        userAgent: request.headers.get("user-agent"),
        referer: request.headers.get("referer"),
        origin: request.headers.get("origin"),
      },
    });

    const body = await request.json();
    const { email } = body;

    logger.info(`[FORGOT PASSWORD API] ${requestId} - Parsed request body`, {
      hasEmail: !!email,
      emailLength: email?.length,
    });

    if (!email || typeof email !== "string") {
      logger.warn(`[FORGOT PASSWORD API] ${requestId} - Missing email`);
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      logger.warn(`[FORGOT PASSWORD API] ${requestId} - Invalid email format`, {
        email: email.trim(),
      });
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }

    const supabase = await createClient();

    // Use Supabase's built-in password reset functionality
    // This will send an email automatically with a reset link
    // Supabase verify endpoint redirects to reset-password with hash fragments (#access_token=...&type=recovery)
    // IMPORTANT: The redirectTo URL must be whitelisted in Supabase Dashboard > Authentication > URL Configuration
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://servio-production.up.railway.app";
    const redirectUrl = `${appUrl.replace(/\/$/, "")}/reset-password`;

    logger.info(`[FORGOT PASSWORD API] ${requestId} - Preparing to send reset email`, {
      email: email.trim(),
      redirectUrl,
      appUrl,
      envVars: {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    });

    const resetStartTime = Date.now();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    const resetDuration = Date.now() - resetStartTime;

    logger.info(`[FORGOT PASSWORD API] ${requestId} - Supabase resetPasswordForEmail response`, {
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStatus: error?.status,
      duration: `${resetDuration}ms`,
      totalDuration: `${Date.now() - startTime}ms`,
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
