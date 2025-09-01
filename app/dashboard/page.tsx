import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      console.log('[DASHBOARD] No auth cookie found, redirecting to sign-in');
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('[DASHBOARD] Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      console.log('[DASHBOARD] No user found, redirecting to sign-in');
      redirect('/sign-in');
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
  } catch (error) {
    console.error('[DASHBOARD] Unexpected error:', error);
    redirect('/sign-in');
  }
}