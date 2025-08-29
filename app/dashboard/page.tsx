import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/utils';

export default async function DashboardPage() {
  // Check for auth cookies before making auth calls
  const hasAuthCookie = await hasServerAuthCookie();
  if (!hasAuthCookie) {
    console.log('[DASHBOARD] No auth cookie found, redirecting to home');
    redirect('/');
  }

  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  console.log('[DASHBOARD] Session found, checking venues for user:', user.id);

  // Get the user's primary venue
  const { data: venues, error } = await supabase
    .from('venues')
    .select('venue_id, venue_name')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[DASHBOARD] Error fetching venues:', error);
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