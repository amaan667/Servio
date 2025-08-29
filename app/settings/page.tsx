export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  if (!venues || venues.length === 0) redirect('/complete-profile');

  // Redirect to the venue-specific settings page
  redirect(`/dashboard/${venues[0].venue_id}/settings`);
}
