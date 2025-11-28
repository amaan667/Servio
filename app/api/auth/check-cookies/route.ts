import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiErrors } from '@/lib/api/standard-response';

export async function GET() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter((c) => c.name.includes("sb-") || c.name.includes("auth"));

    logger.info("[CHECK COOKIES] Current cookies:", {
      totalCookies: allCookies.length,
      authCookiesCount: authCookies.length,
      authCookieNames: authCookies.map((c) => c.name).join(", "),
      allCookieNames: allCookies.map((c) => c.name).join(", "),
    });

    return NextResponse.json({
      totalCookies: allCookies.length,
      authCookiesCount: authCookies.length,
      authCookies: authCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
      allCookies: allCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
    });
  } catch (err) {
    logger.error("[CHECK COOKIES] Error:", { error: err });
    return apiErrors.internal('Failed to check cookies');
  }
}
