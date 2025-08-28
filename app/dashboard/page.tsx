import { redirect } from 'next/navigation';
import { createClient } from '@/lib/sb-client';

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Get the user's primary venue
  const { data: venues, error } = await supabase
    .from('venues')
    .select('venue_id, venue_name')
    .eq('owner_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error fetching venues:', error);
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    redirect('/complete-profile');
  }

  // Redirect to the primary venue's dashboard
  redirect(`/dashboard/${venues[0].venue_id}`);
}