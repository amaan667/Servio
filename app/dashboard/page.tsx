import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, venue_name, created_at')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true });

  if (!venues || venues.length === 0) return null;

  // Redirect to main venue (first one created during signup)
  // First venue by created_at is the main venue, others are secondary
  const mainVenue = venues[0];
  redirect(`/dashboard/${mainVenue.venue_id}`);
}