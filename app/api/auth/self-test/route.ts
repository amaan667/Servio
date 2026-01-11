export const dynamic = "force-dynamic";
export const revalidate = false;
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
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
