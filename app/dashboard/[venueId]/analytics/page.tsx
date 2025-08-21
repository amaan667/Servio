export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import AnalyticsClient from './AnalyticsClient';
import { cookieAdapter } from '@/lib/server/supabase';

export default async function AnalyticsPage({ params }: { params: { venueId: string } }) {
  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('ANALYTICS SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  const { data: venue, error: vErr } = await supabase
    .from('venues').select('venue_id,name').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

  log('ANALYTICS SSR venue', { ok: !!venue, err: vErr?.message });
  if (vErr || !venue) return notFound();

  return <AnalyticsClient venueId={params.venueId} venueName={venue.name} />;
}
