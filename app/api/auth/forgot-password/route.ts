import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

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
      return apiErrors.badRequest("Email address is required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      logger.warn(`[FORGOT PASSWORD API] ${requestId} - Invalid email format`, {
        email: email.trim(),
      });
      return apiErrors.badRequest("Invalid email address format");
    }

    const supabase = await createClient();

    // Use Supabase's built-in password reset functionality
    // This sends an email with a reset link that redirects to /reset-password
    // IMPORTANT: The redirectTo URL must be whitelisted in Supabase Dashboard:
    // Authentication > URL Configuration > Redirect URLs
    //
    // Try to get the actual origin from the request first, then fall back to env vars
    const origin =
      request.headers.get("origin") || request.headers.get("x-forwarded-host")
        ? `https://${request.headers.get("x-forwarded-host")}`
        : null;

    const appUrl =
      origin ||
      env("NEXT_PUBLIC_APP_URL") ||
      env("NEXT_PUBLIC_SITE_URL") ||
      "https://servio-production.up.railway.app";
    const redirectUrl = `${appUrl.replace(/\/$/, "")}/reset-password`;

    logger.info(`[FORGOT PASSWORD API] ${requestId} - Preparing to send reset email`, {
      email: email.trim(),
      redirectUrl,
      origin,
      envUrl: env("NEXT_PUBLIC_APP_URL") || env("NEXT_PUBLIC_SITE_URL"),
      headers: {
        origin: request.headers.get("origin"),
        host: request.headers.get("host"),
        forwardedHost: request.headers.get("x-forwarded-host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
      },
      warning:
        "Ensure this redirectUrl is whitelisted in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs",
    });

    // Ensure redirect URL is absolute and properly formatted
    // Supabase requires exact match with whitelisted URLs
    const finalRedirectUrl = redirectUrl.startsWith("http")
      ? redirectUrl
      : `https://${redirectUrl}`;

    logger.info(`[FORGOT PASSWORD API] ${requestId} - Final redirect URL`, {
      finalRedirectUrl,
      originalRedirectUrl: redirectUrl,
    });

    const resetStartTime = Date.now();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: finalRedirectUrl,
      // Note: Supabase password reset links expire after 1 hour by default
      // This cannot be changed via the API - it's configured in Supabase Dashboard
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
