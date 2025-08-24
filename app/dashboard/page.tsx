export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { ENV } from '@/lib/env';

export default async function DashboardIndex() {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();

  if (!user) {
    console.log('[DASH] no session -> /sign-in');
    redirect('/sign-in');
  }

  // Fetch primary venue id for the owner
  const { data: venue } = await supa
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!venue?.venue_id) {
    console.log('[DASH] session ok, no venue -> /complete-profile');
    redirect('/complete-profile');
  }

  console.log('[DASH] session ok -> /dashboard/:venueId');
  // Use relative redirect (base handled by Next)
  redirect(`/dashboard/${venue.venue_id}`);
}