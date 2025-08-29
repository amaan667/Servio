export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/utils';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  // Check for auth cookies before making auth calls
  const hasAuthCookie = await hasServerAuthCookie();
  if (!hasAuthCookie) {
    console.log('[SETTINGS] No auth cookie found, redirecting to sign-in');
    redirect('/sign-in');
  }

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
