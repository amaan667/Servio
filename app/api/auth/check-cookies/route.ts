import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/standard-response";

export async function GET() {
  try {
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
    return apiErrors.internal("Failed to check cookies");
  }
}
