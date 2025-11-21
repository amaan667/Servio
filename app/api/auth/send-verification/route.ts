// Send email verification
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Check if already verified
    if (user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: "Email already verified",
        verified: true,
      });
    }

    // Send verification email
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email!,
    });

    if (error) {
      logger.error("[EMAIL VERIFICATION] Failed to send:", error);
      return NextResponse.json(
        { error: "Failed to send verification email", details: error.message },
        { status: 500 }
      );
    }

    // Also send custom email
    await sendEmail({
      to: user.email!,
      subject: "Verify your Servio account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verify your email address</h2>
          <p>Hi ${user.user_metadata?.full_name || "there"},</p>
          <p>Please verify your email address to complete your account setup.</p>
          <p>Check your email for a verification link from Supabase, or click the button below:</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
      text: `Verify your email address. Check your email for a verification link.`,
    });

    return NextResponse.json({
      success: true,
      message: "Verification email sent",
    });
  } catch (_error) {
    logger.error("[EMAIL VERIFICATION] Error:", _error);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
}
