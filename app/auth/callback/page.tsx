export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

type Search = { code?: string; next?: string | null };

export default async function AuthCallbackPage(
  { searchParams }: { searchParams: Search }
) {
  // 1) Require the OAuth "code"
  const code = searchParams?.code;
  if (!code) redirect('/sign-in?error=no_code');

  // 2) Server Supabase client with cookie bridge
  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
        remove: (n, o) => jar.set({ name: n, value: '', ...o }),
      },
    }
  );

  // 3) Exchange code -> sets auth cookies on this response
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) redirect('/sign-in?error=exchange_failed');

  // 4) We have a session—decide where to send the user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in?error=no_user');

  // If you support ?next=... keep it (optional)
  if (searchParams?.next) {
    redirect(String(searchParams.next));
  }

  // 5) New vs existing user: check for a venue owned by this user
  const { data: venues, error: venuesErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  if (venuesErr) {
    // If RLS blocks or table not ready, at least land them somewhere safe
    redirect('/complete-profile?error=venues_query');
  }

  if (!venues?.length) {
    // First-time login: no venue yet → go complete profile
    redirect('/complete-profile');
  }

  // Existing account → go straight to their dashboard
  redirect(`/dashboard/${venues[0].venue_id}`);
}
