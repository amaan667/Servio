import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map(c => c.name);
  if (!hasSupabaseAuthCookies(names)) {
    return <div>Please sign in.</div>;
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Please sign in.</div>;
  }

  console.log('[DASHBOARD] Session found, checking venues for user:', user.id);

  // Get the user's primary venue
  const { data: venues, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (venueError) {
    console.error('[DASHBOARD] Error fetching venues:', venueError);
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    console.log('[DASHBOARD] No venues found, redirecting to complete profile');
    redirect('/complete-profile');
  }

  console.log('[DASHBOARD] Found venue, redirecting to:', venues[0].venue_id);
  // Redirect to the primary venue's dashboard
  redirect(`/dashboard/${venues[0].venue_id}`);
}