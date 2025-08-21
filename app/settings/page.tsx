export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      <p className="text-gray-600">Your settings page is ready.</p>
    </main>
  );
}

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
