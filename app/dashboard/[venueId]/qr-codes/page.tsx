export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import QrCodesClient from './QrCodesClient';

export default async function QrCodesPage({ params }: { params: { venueId: string } }) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('QR_CODES SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  const { data: venue, error: vErr } = await supabase
    .from('venues').select('venue_id,name').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

  log('QR_CODES SSR venue', { ok: !!venue, err: vErr?.message });
  if (vErr || !venue) return notFound();

  return <QrCodesClient venueId={params.venueId} venueName={venue.name} />;
} 