import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = false;

export async function GET(req: Request) {
  const u = new URL(req.url);
  // ✅ Preserve the entire querystring verbatim
  const dest = new URL(`/auth/callback${u.search}`, u.origin);
  return NextResponse.redirect(dest, { status: 307 });
}
