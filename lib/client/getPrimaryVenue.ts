'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const getPrimaryVenueIdClient = async (): Promise<string | null> => {
  const supabase = createClientComponentClient();
  
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
