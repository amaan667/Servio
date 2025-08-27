import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = false;

export async function GET(req: Request) {
  const u = new URL(req.url);
  return NextResponse.redirect(new URL(`/auth/callback?${u.searchParams}`, u.origin), { status: 307 });
}
