export const runtime = 'nodejs';
import { createServerSupabase } from '@/lib/supabase';

export async function getPrimaryVenueId(): Promise<string | null> {
  const supa = await createServerSupabase();

  const { data: { user } } = await supa.auth.getSession();
  if (!user) return null;

  const { data } = await supa
    .from('venues')
    .select('venue_id')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  return data?.[0]?.venue_id || null;
}
