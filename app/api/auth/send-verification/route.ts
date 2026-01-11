// Send email verification
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { apiErrors } from "@/lib/api/standard-response";

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    // Use getUser() for secure authentication
    const {
      data: { user },

    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    // Check if already verified
    if (user.email_confirmed_at) {
      return NextResponse.json({

    }

    // Send verification email
    const { error } = await supabase.auth.resend({

    if (error) {
      
      return NextResponse.json(
        { error: "Failed to send verification email", details: error.message },
        { status: 500 }
      );
    }

    // Also send custom email
    await sendEmail({

        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verify your email address</h2>
          <p>Hi ${user.user_metadata?.full_name || "there"},</p>
          <p>Please verify your email address to complete your account setup.</p>
          <p>Check your email for a verification link from Supabase, or click the button below:</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,

    return NextResponse.json({

  } catch (_error) {
    
    return apiErrors.internal("Failed to send verification email");
  }
}
