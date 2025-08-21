export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { handleGoogleSignUp } from '@/lib/supabase';

function cookieAdapter(jar: ReturnType<typeof cookies>) {
  return {
    get: (name: string) => jar.get(name)?.value,
    set: (name: string, value: string, options?: any) =>
      jar.set(name, value, {
        ...options,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      }),
    remove: (name: string, options?: any) =>
      jar.set(name, '', {
        ...options,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 0,
      }),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/dashboard';

  console.log('[AUTH] callback starting', {
    hasCode: !!code,
    hasError: !!error,
    base: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=oauth_error', req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', req.url));
  }

  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

  // Only exchange here. Do not exchange anywhere else (middleware, other routes, etc.).
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[AUTH] exchange failed:', exchangeError);
    return NextResponse.redirect(new URL('/sign-in?error=oauth_exchange_failed', req.url));
  }

  // Handle Google OAuth user setup
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('[AUTH] Google OAuth user authenticated:', user.id);
      
      // Check if this is a new Google user (no venues yet)
      const { data: existingVenues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .limit(1);
      
      if (!existingVenues || existingVenues.length === 0) {
        console.log('[AUTH] New Google user, creating venue');
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
        const result = await handleGoogleSignUp(user.id, user.email!, fullName);
        
        if (!result.success) {
          console.error('[AUTH] Failed to create venue for Google user:', result.error);
          return NextResponse.redirect(new URL('/complete-profile', req.url));
        }
        
        console.log('[AUTH] Venue created for Google user:', result.venue?.venue_id);
      } else {
        console.log('[AUTH] Existing Google user, has venues');
      }
    }
  } catch (error) {
    console.error('[AUTH] Error handling Google OAuth user setup:', error);
    // Continue with redirect even if venue creation fails
  }

  return NextResponse.redirect(new URL(next, req.url));
}
