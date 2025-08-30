export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

async function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host') ?? h.get('host')!;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const baseUrl = await getBaseUrl();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  console.log('[AUTH DEBUG] Callback received:', { 
    hasCode: !!code, 
    error, 
    url: req.url 
  });

  if (error) {
    console.log('[AUTH DEBUG] OAuth error in callback:', error);
    return NextResponse.redirect(`${baseUrl}/test-oauth-simple?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.log('[AUTH DEBUG] No code received in callback');
    return NextResponse.redirect(`${baseUrl}/test-oauth-simple?error=no_code`);
  }

  // For PKCE flow, we need to let the client-side handle the code exchange
  // because the code verifier is stored in the browser
  console.log('[AUTH DEBUG] Redirecting to client-side for PKCE exchange');
  return NextResponse.redirect(`${baseUrl}/test-oauth-simple?code=${code}`);
}
