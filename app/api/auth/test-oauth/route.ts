import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";
import { env, getNodeEnv } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/monitoring/structured-logger";

export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return apiErrors.notFound("Not found");
  }

  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  if (!internalSecret) {
    return apiErrors.internal("INTERNAL_API_SECRET (or CRON_SECRET) is not configured");
  }

  if (_request.headers.get("authorization") !== `Bearer ${internalSecret}`) {
    return apiErrors.unauthorized("Unauthorized");
  }

  try {
    const supabase = await createClient();

    // Test OAuth configuration
    const redirectUrl = getAuthRedirectUrl("/auth/callback");

    // Test Supabase connection - use getUser() for secure authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const testResults = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: getNodeEnv(),
        NEXT_PUBLIC_SUPABASE_URL: env("NEXT_PUBLIC_SUPABASE_URL")?.substring(0, 20) + "...",
        hasAnonKey: !!env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        hasServiceRoleKey: !!env("SUPABASE_SERVICE_ROLE_KEY"),
      },
      oauth: {
        redirectUrl,
        expectedRedirectUrl: "https://servio-production.up.railway.app/auth/callback",
        redirectUrlMatches:
          redirectUrl === "https://servio-production.up.railway.app/auth/callback",
      },
      auth: {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        authError: authError?.message,
      },
      providers: {
        hasProviders: false,
        providerCount: 0,
        providersError: "OAuth provider testing disabled",
      },
      request: {
        url: _request.url,
        userAgent: _request.headers.get("user-agent"),
        referer: _request.headers.get("referer"),
      },
    };

    return NextResponse.json(testResults);
  } catch (_error) {
    logger.error("[auth/test-oauth] request failed", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return NextResponse.json(
      {
        error: _error instanceof Error ? _error.message : "Unknown _error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
