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
        getAll() { return cookieStore.getAll(); },
        setAll(all) { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Route based on venues
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id);

  if (venues && venues.length > 0 && venues[0]?.venue_id) {
    redirect(`/dashboard/${venues[0].venue_id}`);
  }

  return (
    <main className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">No venues found. Complete your profile to get started.</p>
          <a href="/complete-profile" className="bg-servio-purple text-white px-6 py-2 rounded inline-block">Complete Profile</a>
        </div>
      </div>
    </main>
  );
}
