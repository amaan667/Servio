import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  // If no user, redirect to home page
  if (!user) {
    redirect('/');
  }

  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, venue_name, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  // If no venues, redirect to home page
  if (!venues || venues.length === 0) {
    redirect('/');
  }

  // Redirect to main venue (first one created during signup)
  // First venue by created_at is the main venue, others are secondary
  const mainVenue = venues[0];
  redirect(`/dashboard/${mainVenue.venue_id}`);
}