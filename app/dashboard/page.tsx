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
  if (userErr || !user) redirect('/sign-in');

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
