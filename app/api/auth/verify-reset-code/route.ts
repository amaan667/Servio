import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return apiErrors.badRequest("Code is required");
    }

    const supabase = await createClient();

    // Password reset codes from Supabase are PKCE codes that need to be exchanged
    // But they don't require a code verifier - Supabase handles it server-side
    // Try to exchange the code for a session
    logger.info("[VERIFY RESET CODE] Attempting code exchange", {
      code: code.substring(0, 10) + "...",
    });

    try {
      // Try exchangeCodeForSession - password reset codes might work without verifier
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        logger.error("[VERIFY RESET CODE] Code exchange failed", error);

        // If code exchange fails, try verifyOtp as fallback
        logger.info("[VERIFY RESET CODE] Trying verifyOtp as fallback");
        const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
          token_hash: code,
          type: "recovery",
        });

        if (otpError || !otpData?.session) {
          return NextResponse.json(
            {
              error: error?.message || otpError?.message || "Invalid or expired reset code",
            },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          session: {
            access_token: otpData.session.access_token,
            refresh_token: otpData.session.refresh_token,
          },
        });
      }

      if (!data?.session) {
        return apiErrors.internal("Failed to create session");
      }

      return NextResponse.json({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      });
    } catch (err) {
      logger.error("[VERIFY RESET CODE] Exception during verification", err);
      return apiErrors.internal("Failed to verify reset code");
    }
  } catch (error) {
    logger.error("[VERIFY RESET CODE] Unexpected error:", error);
    return apiErrors.internal("Failed to verify reset code");
  }
}
