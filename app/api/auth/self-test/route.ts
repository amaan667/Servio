export const dynamic = "force-dynamic";
export const revalidate = false;
import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";

export async function GET(req: NextRequest) {
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

  const cookies = req.cookies.getAll();
  const authCookies = cookies.filter((c) => c.name.includes("auth") || c.name.startsWith("sb-"));
  return NextResponse.json({
    cookieCount: cookies.length,
    hasSupabaseAuthCookie: authCookies.some((c) =>
      /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(c.name)
    ),
    allCookies: cookies.map((c) => ({ name: c.name, value: c.value.substring(0, 20) + "..." })),
    authCookies: authCookies.map((c) => ({
      name: c.name,
      value: c.value.substring(0, 20) + "...",
    })),
    timestamp: new Date().toISOString(),
  });
}
