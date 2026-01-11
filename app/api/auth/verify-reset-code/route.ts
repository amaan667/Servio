import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

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
     + "...",

    try {
      // Try exchangeCodeForSession - password reset codes might work without verifier
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        

        // If code exchange fails, try verifyOtp as fallback
        
        const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({

        if (otpError || !otpData?.session) {
          return NextResponse.json(
            {

            },
            { status: 400 }
          );
        }

        return NextResponse.json({

          },

      }

      if (!data?.session) {
        return apiErrors.internal("Failed to create session");
      }

      return NextResponse.json({

        },

    } catch (err) {
      
      return apiErrors.internal("Failed to verify reset code");
    }
  } catch (error) {
    
    return apiErrors.internal("Failed to verify reset code");
  }
}
