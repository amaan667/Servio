import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Try to verify the code as a recovery OTP
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: code,
      type: "recovery",
    });

    if (error) {
      logger.error("[VERIFY RESET CODE] Error:", error);
      return NextResponse.json(
        { error: error.message || "Invalid or expired reset code" },
        { status: 400 }
      );
    }

    if (!data.session) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    logger.error("[VERIFY RESET CODE] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to verify reset code" }, { status: 500 });
  }
}
