'use client';
import { createClient } from '@/lib/supabase';

export async function getPrimaryVenue() {
  const { data: { user } } = await createClient().auth.getSession();
  if (!user) return null;

  const { data, error } = await createClient()
    .from('venues')
    .select('venue_id')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0].venue_id as string;
};
