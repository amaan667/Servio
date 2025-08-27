import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const to = new URL(`/auth/callback?${u.searchParams}`, u.origin);
  return NextResponse.redirect(to, { status: 307 });
}

export async function POST(req: Request) {
  const u = new URL(req.url);
  const to = new URL(`/auth/callback?${u.searchParams}`, u.origin);
  return NextResponse.redirect(to, { status: 307 });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
