export const runtime = 'nodejs';
import { createServerSupabaseClient } from './supabase';

export async function getPrimaryVenueId(): Promise<string | null> {
  const supa = await createServerSupabaseClient();

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  const { data } = await supa
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  return data?.[0]?.venue_id || null;
}
