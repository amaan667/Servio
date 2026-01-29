import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";

/**
 * Set session from client-side auth
 * This endpoint allows client-side to sync session to server cookies
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return apiErrors.badRequest("access_token and refresh_token are required");
    }

    // Create server-side Supabase client
    const supabase = await createServerSupabase();

    // Use setSession to properly set the session with the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return apiErrors.badRequest(error.message);
    }

    if (!data.session) {
      return apiErrors.internal("Failed to set session");
    }

    // The cookies are automatically set by the Supabase SSR client via setSession
    // Don't manually override them - let Supabase handle the chunking properly
    const response = NextResponse.json({ success: true });

    return response;
  } catch (err) {
    return apiErrors.internal("Internal server error");
  }
}
