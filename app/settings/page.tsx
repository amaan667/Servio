export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import NavBarClient from '@/components/NavBarClient';
import SettingsClient from './SettingsClient.client';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function SettingsPage() {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('SETTINGS SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  // Get user's venues
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id);

  return (
    <>
      <NavBarClient />
      <SettingsClient user={user} venues={venues || []} />
    </>
  );
}
