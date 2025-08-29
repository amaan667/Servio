// Ensure this runs on the Node runtime and is never statically optimized
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(); // uses proxy headers (see below)
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    // propagate the provider error to your UI
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    // nothing to exchange; go home
    return NextResponse.redirect(`${baseUrl}/`);
  }

  // IMPORTANT: server client bound to request/response cookies
  const supabase = createClient(cookies());

  // WAIT for the exchange to complete so Set-Cookie is written
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    // Surface the reason to debug if needed
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=exchange_failed&reason=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // success -> land wherever you want the user to go
  return NextResponse.redirect(`${baseUrl}/dashboard`);
}
