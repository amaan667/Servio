import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/monitoring/structured-logger";

export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return apiErrors.notFound("Not found");
    }

    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
    if (!internalSecret) {
      return apiErrors.internal("INTERNAL_API_SECRET (or CRON_SECRET) is not configured");
    }

    if (req.headers.get("authorization") !== `Bearer ${internalSecret}`) {
      return apiErrors.unauthorized("Unauthorized");
    }

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter((c) => c.name.includes("sb-") || c.name.includes("auth"));

    return NextResponse.json({
      totalCookies: allCookies.length,
      authCookiesCount: authCookies.length,
      authCookies: authCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
      allCookies: allCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
    });
  } catch (err) {
    logger.error("[auth/check-cookies] request failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return apiErrors.internal("Failed to check cookies");
  }
}
