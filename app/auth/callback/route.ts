// app/auth/callback/route.ts
export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code) {
      return new NextResponse('Missing code', { status: 400 });
    }

    // IMPORTANT: do NOT await cookies()
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,       // e.g. https://xxxx.supabase.co
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // anon key
      {
        cookies: {
          get: (n) => cookieStore.get(n)?.value,
          set: (n, v, o) => cookieStore.set({ name: n, value: v, ...o }),
          remove: (n, o) => cookieStore.set({ name: n, value: '', ...o }),
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return new NextResponse('Auth exchange failed: ' + error.message, { status: 400 });
    }

    // 200 HTML so Set-Cookie is kept; then client-redirect to /dashboard
    const html = `<!doctype html><meta charset="utf-8" />
      <title>Finishing sign in…</title>
      <script>location.replace('/dashboard');</script>`;
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (e: any) {
    return new NextResponse('Callback crashed: ' + (e?.message ?? String(e)), { status: 500 });
  }
}
