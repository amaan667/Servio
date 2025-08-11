export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { handleAuthSession } from '@supabase/auth-helpers-nextjs';

export async function GET(req: Request) {
  // Set Supabase cookies on this origin
  const withCookies = await handleAuthSession(req); // 200 + Set-Cookie

  // Return 200 HTML that preserves Set-Cookie and then client-redirects.
  const html = `<!doctype html>
  <meta charset="utf-8" />
  <title>Finishing sign in…</title>
  <p>Finishing sign in…</p>
  <script>location.replace('/dashboard');</script>`;

  const res = new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });

  // copy all Set-Cookie headers from handleAuthSession
  withCookies.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') res.headers.append(k, v);
  });

  return res;
}

export async function POST(req: Request) {
  // Some IdPs POST back; keep this too
  return handleAuthSession(req);
}
