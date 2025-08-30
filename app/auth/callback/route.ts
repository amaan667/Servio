export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
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

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  const supabase = await createClient(cookies());
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=exchange_failed&reason=${encodeURIComponent(exchangeError.message)}`
    );
  }

  return NextResponse.redirect(`${baseUrl}/dashboard`);
}
