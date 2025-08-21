export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import GenerateQRClient from './GenerateQRClient';
import { cookieAdapter } from '@/lib/server/supabase';

export default async function GenerateQRPage() {
  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

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