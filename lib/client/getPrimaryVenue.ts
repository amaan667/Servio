'use client';
import { createBrowserClient } from '@supabase/ssr';

export async function getPrimaryVenue() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0].venue_id as string;
};
