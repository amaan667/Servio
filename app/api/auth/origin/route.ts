import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = false;
export async function GET(request: Request) {
  const u = new URL(request.url);
  return NextResponse.json({ originFromHeader: u.origin, envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL });
}
