export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import GenerateQRClient from './GenerateQRClient';

export default async function GenerateQRPage() {
  const supabase = createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: venue, error } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!venue || error) redirect('/complete-profile');

  return <GenerateQRClient venueId={venue.venue_id} venueName={venue.name} />;
}