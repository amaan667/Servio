export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import ClientNavBar from '@/components/ClientNavBar';
import SettingsClient from './SettingsClient.client';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  console.log('[SETTINGS] User check:', { hasUser: !!user });
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
