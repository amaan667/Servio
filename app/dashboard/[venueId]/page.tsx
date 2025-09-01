export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import DashboardClient from './page.client';

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  console.log('[VENUE PAGE] Checking venue access for:', params.venueId);
  
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      console.log('[VENUE PAGE] No auth cookie found, redirecting to sign-in');
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('VENUE PAGE SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('[VENUE PAGE] Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      console.log('[VENUE PAGE] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    console.log('[VENUE PAGE] Querying venue:', params.venueId);
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    console.log('[VENUE PAGE] Venue query result:', { 
      hasVenue: !!venue, 
      venueId: venue?.venue_id,
      venueName: venue?.name,
      error: venueError?.message,
      userId: user.id,
      requestedVenueId: params.venueId
    });

    if (venueError) {
      console.error('[VENUE PAGE] Database error:', venueError);
      redirect('/?auth_error=database_error');
    }
    
    if (!venue) {
      console.log('[VENUE PAGE] Venue not found - user may not have access or venue does not exist');
      // Check if user has any venues at all before redirecting to sign-in
      const { data: userVenues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .limit(1);
      
      if (userVenues && userVenues.length > 0) {
        // User has venues but not this specific one - redirect to their first venue
        console.log('[VENUE PAGE] User has other venues, redirecting to first venue');
        redirect(`/dashboard/${userVenues[0].venue_id}`);
      } else {
        // User has no venues - redirect to complete profile
        console.log('[VENUE PAGE] User has no venues, redirecting to complete profile');
        redirect('/complete-profile');
      }
    }

    // Get timezone-aware today window (default to Europe/London until migration is run)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Compute unique active tables today (open tickets): status != 'served' and != 'paid' AND created today
    const { data: activeRows } = await supabase
      .from('orders')
      .select('table_number, status, payment_status, created_at')
      .eq('venue_id', params.venueId)
      .not('status', 'in', '(served,paid)')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    const uniqueActiveTables = new Set((activeRows ?? []).map((r: any) => r.table_number).filter((t: any) => t != null)).size;

    console.log('[VENUE PAGE] Active tables:', { 
      venueId: params.venueId, 
      activeTables: uniqueActiveTables 
    });

    return (
      <DashboardClient 
        venueId={params.venueId} 
        userId={user.id}
        activeTables={uniqueActiveTables}
        venue={venue}
        userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
      />
    );
  } catch (error) {
    console.error('[VENUE PAGE] Error in venue page:', error);
    redirect('/sign-in');
  }
}
