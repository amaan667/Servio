export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import MenuClient from './MenuClient';
import { cookieAdapter } from '@/lib/server/supabase';

export default async function MenuPage({ params }: { params: { venueId: string } }) {
  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('MENU SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  const { data: venue, error: vErr } = await supabase
    .from('venues').select('venue_id,name').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

  log('MENU SSR venue', { ok: !!venue, err: vErr?.message });
  if (vErr || !venue) return notFound();

  return <MenuClient venueId={params.venueId} venueName={venue.name} />;
}
