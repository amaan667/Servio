export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import VenueSettingsClient from './VenueSettingsClient';
import PageHeader from '@/components/PageHeader';

export default async function VenueSettingsPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[SETTINGS] Page mounted for venue', params.venueId);
  
  // [AUTH] Use proper server Supabase client with cookie handling
  const supabase = createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={`Settings for ${venue.name}`}
          description="Manage your account and venue settings"
          venueId={params.venueId}
        />
        
        <VenueSettingsClient user={user} venue={venue} venues={venues || []} />
      </div>
    </div>
  );
}
