import { getUserSafe } from '../../utils/getUserSafe'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const user = await getUserSafe('app/dashboard/page.tsx')
  if (!user) {
    redirect('/sign-in')
  }

  console.log('[DASHBOARD] Session found, checking venues for user:', user.id);

  const supabase = await createClient();

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