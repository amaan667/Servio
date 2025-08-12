export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import QRCodeClient from './QRCodeClient';

export default async function QRCodePage({ params }: { params: { venueId: string } }) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Verify user owns this venue
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .single();

  if (venueError || !venue) {
    redirect('/dashboard');
  }

  return <QRCodeClient venueId={params.venueId} venueName={venue.name} />;
}