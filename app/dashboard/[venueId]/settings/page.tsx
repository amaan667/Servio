export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';

export default async function VenueSettings({ params }: { params: { venueId: string } }) {
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map(c => c.name);
  if (!hasSupabaseAuthCookies(names)) {
    return <div>Please sign in.</div>;
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Please sign in.</div>;
  }

  const { data: venue, error } = await supabase
    .from('venues')
    .select('id, name, slug, owner_id')
    .eq('slug', params.venueId)
    .single();

  if (error) {
    console.error('Failed to load venue', error);
    return <div>Error loading venue</div>;
  }

  return <div>Settings for {venue.name}</div>;
}
