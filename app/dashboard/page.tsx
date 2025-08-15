export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';

export default async function DashboardIndex() {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('DASHBOARD INDEX user', { hasUser: !!user, userId: user?.id });
  if (!user) redirect('/sign-in');

  const { data: venues, error } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  log('DASHBOARD INDEX venues', { venuesCount: venues?.length, error: error?.message });

  if (error) {
    console.error('[DASHBOARD] venues error:', error);
    redirect('/complete-profile?error=venues');
  }
  if (!venues?.length) redirect('/complete-profile');

  log('DASHBOARD INDEX redirecting', { venueId: venues[0].venue_id });
  redirect(`/dashboard/${venues[0].venue_id}`);
}
