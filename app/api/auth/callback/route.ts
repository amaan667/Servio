import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = false;

export async function GET(req: Request) {
  const u = new URL(req.url);
  
  // Determine the correct base URL for the redirect
  let baseUrl: string;
  if (process.env.NODE_ENV === 'production') {
    // In production, use environment variables
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
              process.env.APP_URL || 
              process.env.NEXT_PUBLIC_APP_URL || 
              'https://servio-production.up.railway.app';
  } else {
    // In development, use the request origin
    baseUrl = u.origin;
  }
  
  // ✅ Preserve the entire querystring verbatim
  const dest = new URL(`/auth/callback${u.search}`, baseUrl);
  return NextResponse.redirect(dest, { status: 307 });
}
