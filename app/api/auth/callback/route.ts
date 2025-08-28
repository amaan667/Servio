import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = false;
export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const hasCode = u.searchParams.has('code');
    const hasState = u.searchParams.has('state');
    console.log('[OAuth Backend] /api/auth/callback GET', {
      hasCode,
      hasState,
      timestamp: new Date().toISOString()
    });
  } catch {}
  return NextResponse.redirect(new URL(`/auth/callback?${u.searchParams}`, u.origin), { status: 307 });
}
