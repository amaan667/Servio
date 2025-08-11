export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export default async function DashboardPage() {
  const cookieStore = cookies(); // <- no await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      },
    }
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    // Clear corrupted session and redirect
    console.error('Auth error in dashboard:', userErr?.message);
    if (userErr?.message?.includes('Refresh Token')) {
      // Force session cleanup
      return (
        <div className="p-6 text-center">
          <h1 className="text-xl font-semibold text-red-600">Session Expired</h1>
          <p className="mt-2">Your session has expired. Please sign in again.</p>
          <button 
            onClick={() => window.location.href = '/sign-in'}
            className="mt-4 bg-servio-purple text-white px-4 py-2 rounded"
          >
            Sign In Again
          </button>
          <script dangerouslySetInnerHTML={{
            __html: `
              // Clear localStorage auth
              Object.keys(localStorage).forEach(key => {
                if (key.includes('supabase') || key.includes('auth')) {
                  localStorage.removeItem(key);
                }
              });
              // Redirect after 3 seconds
              setTimeout(() => window.location.href = '/sign-in', 3000);
            `
          }} />
        </div>
      );
    }
    redirect('/sign-in');
  }

  const { data: venues, error: venuesErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id);

  if (venuesErr) {
    // TEMP: surface the error instead of spinner so we see it
    return (
      <pre className="p-4 text-red-600">
        Venues error: {venuesErr.message}
      </pre>
    );
  }

  if (venues?.length && venues[0]?.venue_id) {
    redirect(`/dashboard/${venues[0].venue_id}`);
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2">No venues found. <a className="underline" href="/complete-profile">Complete your profile</a>.</p>
    </main>
  );
}
