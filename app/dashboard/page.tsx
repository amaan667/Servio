import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect('/sign-in');
  }

  // Get user's primary venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (venue?.venue_id) {
    redirect(`/dashboard/${venue.venue_id}`);
  }

  redirect('/complete-profile');
}

