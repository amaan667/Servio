export const runtime = 'nodejs';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getPrimaryVenueId(): Promise<string | null> {
  const jar = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  const { data, error } = await supa
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0].venue_id as string;
}
