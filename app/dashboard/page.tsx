export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name, options) =>
          cookieStore.set({ name, value: '', ...options }),
      },
    }
  );

  // 1) Auth (server)
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.error('getUser error', userErr);
    redirect('/sign-in');
  }
  if (!user) redirect('/sign-in');

  // 2) Route by venue (handle RLS/empty safely)
  const { data: venues, error: venuesErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id);

  if (venuesErr) {
    // Most common cause is missing RLS policy: allow owner to SELECT.
    // Show a simple page instead of infinite loading.
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-4 text-red-600">Error loading venues: {venuesErr.message}</p>
        <a href="/complete-profile" className="underline">Go to Complete Profile</a>
      </main>
    );
  }

  if (venues?.length && venues[0]?.venue_id) {
    redirect(`/dashboard/${venues[0].venue_id}`);
  }

  // 3) Fallback when no venues
  return (
    <main className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">
            No venues found. Complete your profile to get started.
          </p>
          <a href="/complete-profile" className="bg-servio-purple text-white px-6 py-2 rounded inline-block">
            Complete Profile
          </a>
        </div>
      </div>
    </main>
  );
}
