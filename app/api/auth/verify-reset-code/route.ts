import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    // Try to verify through Supabase's verify endpoint directly
    // Password reset codes need to go through /auth/v1/verify
    const supabaseUrl = getSupabaseUrl();
    const verifyUrl = `${supabaseUrl}/auth/v1/verify`;

    logger.info("[VERIFY RESET CODE] Attempting verification", {
      code: code.substring(0, 10) + "...",
    });

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: getSupabaseAnonKey(),
      },
      body: JSON.stringify({
        token_hash: code,
        type: "recovery",
      }),
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      logger.error("[VERIFY RESET CODE] Verification failed", verifyData);
      return NextResponse.json(
        {
          error:
            verifyData.error_description || verifyData.message || "Invalid or expired reset code",
        },
        { status: verifyResponse.status }
      );
    }

    if (!verifyData.access_token) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
      },
    });
  } catch (error) {
    logger.error("[VERIFY RESET CODE] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to verify reset code" }, { status: 500 });
  }
}
