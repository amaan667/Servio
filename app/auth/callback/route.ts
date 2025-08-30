// /app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { getOriginFromHeaders } from '@/lib/auth/utils';

export async function GET(req: NextRequest) {
  const url     = new URL(req.url);
  const code    = url.searchParams.get('code');
  const origin  = getOriginFromHeaders(req.headers);
  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`);

  if (!code) return redirect('/auth/error?reason=missing_code');

  const supabase = createServerSupabase();

  // Skip duplicate exchanges if already signed in
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return redirect('/dashboard');

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirect(`/auth/error?reason=${encodeURIComponent(error.message)}`);

<<<<<<< Current (Your changes)
  return redirect('/dashboard')
}

=======
  return redirect('/dashboard');
}
>>>>>>> Incoming (Background Agent changes)
