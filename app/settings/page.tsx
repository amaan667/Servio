export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import SettingsClient from './SettingsClient.client';

export default async function SettingsPage() {
  const supabase = createServerSupabase();

  const { data: { user } } = await (await supabase).auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: venues } = await (await supabase)
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  if (!venues || venues.length === 0) redirect('/complete-profile');

  return <SettingsClient user={user as any} venues={venues as any} />;
}
