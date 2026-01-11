import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

import { env } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {

      return apiErrors.badRequest("Email address is required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {

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

    // Ensure redirect URL is absolute and properly formatted
    // Supabase requires exact match with whitelisted URLs
    const finalRedirectUrl = redirectUrl.startsWith("http")
      ? redirectUrl
      : `https://${redirectUrl}`;

    const resetStartTime = Date.now();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: finalRedirectUrl,
      // Note: Supabase password reset links expire after 1 hour by default
      // This cannot be changed via the API - it's configured in Supabase Dashboard
    });
    const resetDuration = Date.now() - resetStartTime;

    if (error) {

      // Don't reveal if email exists or not for security
      // Always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (_error) {

    // Still return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  }
}
