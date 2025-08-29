import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = false;

export async function GET(req: Request) {
  const u = new URL(req.url);
  
  console.log('[AUTH DEBUG] API callback received:', {
    url: req.url,
    search: u.search,
    hasCode: !!u.searchParams.get('code'),
    hasError: !!u.searchParams.get('error'),
    origin: u.origin,
    hostname: u.hostname,
    protocol: u.protocol
  });
  
  console.log('[AUTH DEBUG] Environment variables in callback:');
  console.log('[AUTH DEBUG] NODE_ENV:', process.env.NODE_ENV);
  console.log('[AUTH DEBUG] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  console.log('[AUTH DEBUG] APP_URL:', process.env.APP_URL);
  console.log('[AUTH DEBUG] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  
  // Determine the correct base URL for the redirect
  let baseUrl: string;
  if (process.env.NODE_ENV === 'production') {
    // In production, use environment variables
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
              process.env.APP_URL || 
              process.env.NEXT_PUBLIC_APP_URL || 
              'https://servio-production.up.railway.app';
    console.log('[AUTH DEBUG] Production baseUrl:', baseUrl);
  } else {
    // In development, use the request origin
    baseUrl = u.origin;
    console.log('[AUTH DEBUG] Development baseUrl:', baseUrl);
  }
  
  // Check if we have an authorization code or error
  const code = u.searchParams.get('code');
  const error = u.searchParams.get('error');
  
  if (!code && !error) {
    console.log('[AUTH DEBUG] No code or error in callback - redirecting home');
    const homeUrl = new URL('/?auth_error=missing_code', baseUrl);
    return NextResponse.redirect(homeUrl, { status: 307 });
  }
  
  // Preserve the entire querystring verbatim for the client-side callback
  const dest = new URL(`/auth/callback${u.search}`, baseUrl);
  
  console.log('[AUTH DEBUG] API callback redirecting to:', dest.toString());
  
  return NextResponse.redirect(dest, { status: 307 });
}
