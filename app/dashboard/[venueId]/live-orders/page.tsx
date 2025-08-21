export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/server/supabase';
import LiveOrdersClient from './LiveOrdersClient';

export default async function LiveOrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: venue, error } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error || !venue) redirect('/sign-in');

  return <LiveOrdersClient venueId={venueId} venueName={venue.name} />;
}