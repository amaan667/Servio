export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import ClientNavBar from '@/components/ClientNavBar';
import VenueSettingsClient from './VenueSettingsClient';

export default async function VenueSettingsPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[SETTINGS] Page mounted for venue', params.venueId);
  
  // [AUTH] Use proper server Supabase client with cookie handling
  const supabase = createServerSupabase();

  const { data: { user } } = await createClient().auth.getUser();
  log('VENUE SETTINGS SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name, email, phone, address')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  // Get user's venues for the settings component
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientNavBar venueId={params.venueId} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Settings for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage your account and venue settings
          </p>
        </div>
        
        <VenueSettingsClient user={user} venue={venue} venues={venues || []} />
      </div>
    </div>
  );
}
