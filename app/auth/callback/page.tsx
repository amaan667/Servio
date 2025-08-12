// app/auth/callback/page.tsx
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
  const code = searchParams?.code;
  if (!code) redirect('/sign-in?error=no_code');

  const jar = cookies();

  try {
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

    // 1) Exchange
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeErr) {
      console.error('[AUTH] exchange failed:', exchangeErr);
      return (
        <div style={{ padding: 24 }}>
          <h1>Auth exchange failed</h1>
          <pre>{exchangeErr.message}</pre>
          <a href="/sign-in">Back to sign in</a>
        </div>
      );
    }

    // 2) User + venues
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error('[AUTH] getUser error:', userErr);
      return (
        <div style={{ padding: 24 }}>
          <h1>Signed in, but no user found</h1>
          <a href="/sign-in">Back to sign in</a>
        </div>
      );
    }

    const { data: venues, error: venuesErr } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .limit(1);

    if (venuesErr) {
      console.error('[AUTH] venues query error:', venuesErr);
      redirect('/complete-profile?error=venues_query');
    }

    if (!venues?.length) {
      redirect('/complete-profile');
    }

    redirect(`/dashboard/${venues![0].venue_id}`);
  } catch (e: any) {
    console.error('[AUTH] callback crash:', e);
    return (
      <div style={{ padding: 24 }}>
        <h1>Callback crashed</h1>
        <pre>{e?.message || String(e)}</pre>
        <a href="/sign-in">Back to sign in</a>
      </div>
    );
  }
}
