import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }

  const { data: venues, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name, created_at')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true });

  if (venueError) {
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    redirect('/complete-profile');
  }

  const mainVenue = venues[0];
  redirect(`/dashboard/${mainVenue.venue_id}`);
}