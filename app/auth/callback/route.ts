// app/auth/callback/route.ts
export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');

  // Create a Supabase client bound to this route + cookie jar
  const supabase = createRouteHandlerClient({ cookies });

  // Require the code
  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=no_code', url));
  }

  // Exchange the code -> sets auth cookies on this response
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    return NextResponse.redirect(new URL('/sign-in?error=exchange_failed', url));
  }

  // Decide destination: next? existing venue? otherwise complete-profile
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in?error=no_user', url));
  }

  if (next) {
    return NextResponse.redirect(new URL(String(next), url));
  }

  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  const dest = venues?.length
    ? `/dashboard/${venues[0].venue_id}`
    : '/complete-profile';

  return NextResponse.redirect(new URL(dest, url));
}
