export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import ClientNavBar from '@/components/ClientNavBar';
import SettingsClient from './SettingsClient.client';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function SettingsPage() {
  // [AUTH] Use proper server Supabase client with cookie handling
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  log('SETTINGS SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  // Get user's venues for the settings component
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id);

  return (
    <>
      <ClientNavBar venueId={venues?.[0]?.venue_id} />
      <SettingsClient user={user} venues={venues || []} />
    </>
  );
}
