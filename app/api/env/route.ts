import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { apiErrors, success } from "@/lib/api/standard-response";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return apiErrors.notFound("Not found");
  }

  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  if (!internalSecret) {
    return apiErrors.internal("INTERNAL_API_SECRET (or CRON_SECRET) is not configured");
  }

  if (request.headers.get("authorization") !== `Bearer ${internalSecret}`) {
    return apiErrors.unauthorized("Unauthorized");
  }

  const body = {
    NEXT_PUBLIC_SITE_URL: env("NEXT_PUBLIC_SITE_URL"),
    APP_URL: env("APP_URL"),
    NEXT_PUBLIC_SUPABASE_URL: env("NEXT_PUBLIC_SUPABASE_URL"),
    HAS_SUPABASE_ANON: !!env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    TIP: "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Railway.",
  };
  return success(body);
}
