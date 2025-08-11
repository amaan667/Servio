// app/auth/callback/route.ts
export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new NextResponse('Missing code', { status: 400 });
  }

  // This helper knows how to fetch the PKCE code_verifier and set cookies properly
  const supabase = createRouteHandlerClient({ cookies });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return new NextResponse('Auth exchange failed: ' + error.message, { status: 400 });
  }

  // Return 200 HTML so Set-Cookie is preserved, then client-redirect to /dashboard
  const html = `<!doctype html><meta charset="utf-8" />
    <title>Finishing sign in…</title>
    <script>location.replace('/dashboard');</script>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
