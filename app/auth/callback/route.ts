export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { handleAuthSession } from '@supabase/auth-helpers-nextjs';

export async function GET(req: Request) {
  // 1) Let Supabase set the cookies on this domain
  const withCookies = await handleAuthSession(req); // 200 + Set-Cookie

  // 2) Build a 200 HTML response that copies ALL Set-Cookie headers, then JS-redirects
  const html = `<!doctype html>
  <meta charset="utf-8" />
  <title>Signing you in…</title>
  <p>Signing you in…</p>
  <script>location.replace('/dashboard');</script>`;

  const res = new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });

  // Preserve every Set-Cookie from handleAuthSession
  withCookies.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') res.headers.append(key, value);
  });

  return res;
}

// Some IdPs POST back; cover POST the same way
export async function POST(req: Request) {
  const withCookies = await handleAuthSession(req);
  const res = new NextResponse('OK');
  withCookies.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') res.headers.append(key, value);
  });
  return res;
}
