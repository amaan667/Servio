import { NextRequest, NextResponse } from "next/server";

import { env, isProduction } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "access_token and refresh_token are required" },
        { status: 400 }
      );
    }

    // Create response object first so we can set cookies on it
    const response = NextResponse.json({ success: true });

    // Get Supabase project ID from URL for cookie names
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL") || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";

    if (!projectRef) {
      return apiErrors.internal("Configuration error");
    }

    // Set cookies manually with correct names
    const cookieOptions = {
      path: "/",
      sameSite: "lax" as const,
      secure: isProduction(),
      httpOnly: false, // Must be false for Supabase client to read
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    // Set the auth token cookies
    response.cookies.set(`sb-${projectRef}-auth-token`, access_token, cookieOptions);
    response.cookies.set(`sb-${projectRef}-auth-token-refresh`, refresh_token, cookieOptions);

    return response;
  } catch (err) {
    return apiErrors.internal("Internal server error");
  }
}
