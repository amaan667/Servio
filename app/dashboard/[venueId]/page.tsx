export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log, error } from '@/lib/debug';
import { todayWindowForTZ } from '@/lib/time';
import { createServerSupabaseClient } from '@/lib/server/supabase';
import DashboardClient from './page.client';

export default async function VenuePage({ params, searchParams }: { params: { venueId: string }, searchParams: any }) {
  console.log('[VENUE PAGE] params.venueId =', params.venueId);
  
  // [AUTH] Use proper server Supabase client with cookie handling
  const supabase = createServerSupabaseClient();
  console.log('[DASHBOARD VENUE] Supabase client created with proper cookies');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[DASHBOARD VENUE] Auth getUser result:', { 
    hasUser: !!user, 
    userId: user?.id, 
    userError: userError?.message 
  });
  console.log('[DASHBOARD/venue] dynamic=true', { venueId: params.venueId, hasUser: !!user });
  
  log('DASH SSR user', { hasUser: !!user });
  if (!user) {
    console.log('[DASHBOARD VENUE] No user found, redirecting to sign-in');
    redirect('/sign-in');
  }

  console.log('[DASHBOARD VENUE] Querying venue:', params.venueId);
  const { data: venue, error: vErr } = await supabase
    .from('venues').select('venue_id,name').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

  console.log('[DASHBOARD VENUE] Venue query result:', { 
    hasVenue: !!venue, 
    venueId: venue?.venue_id,
    venueName: venue?.name,
    error: vErr?.message,
    userId: user.id,
    requestedVenueId: params.venueId
  });

  log('DASH SSR venue', { ok: !!venue, err: vErr?.message });
  if (vErr) {
    console.error('[DASHBOARD VENUE] Database error:', vErr);
    // If it's a database connection error, don't redirect to sign-in
    // Instead, we should show an error page or retry
    error('Venue query error', vErr);
    redirect('/sign-in?error=database_error');
  }
  if (!venue) {
    console.log('[DASHBOARD VENUE] Venue not found - user may not have access or venue does not exist');
    // Check if user has any venues at all before redirecting to sign-in
    const { data: userVenues } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .limit(1);
    
    if (userVenues && userVenues.length > 0) {
      // User has venues but not this specific one - redirect to their first venue
      console.log('[DASHBOARD VENUE] User has other venues, redirecting to first venue');
      redirect(`/dashboard/${userVenues[0].venue_id}`);
    } else {
      // User has no venues - redirect to complete profile
      console.log('[DASHBOARD VENUE] User has no venues, redirecting to complete profile');
      redirect('/complete-profile');
    }
  }

  // Get timezone-aware today window (default to Europe/London until migration is run)
  const todayWindow = todayWindowForTZ('Europe/London');
  
  // Compute unique active tables today (open tickets): status != 'served' and != 'paid' AND created today
  const { data: activeRows } = await supabase
    .from('orders')
    .select('table_number, status, payment_status, created_at')
    .eq('venue_id', params.venueId)
    .not('status', 'in', '(served,paid)')
    .gte('created_at', todayWindow.startUtcISO)
    .lt('created_at', todayWindow.endUtcISO);
  const uniqueActiveTables = new Set((activeRows ?? []).map((r: any) => r.table_number).filter((t: any) => t != null)).size;

  log('DASH SSR active tables', { 
    venueId: params.venueId, 
    zone: todayWindow.zone, 
    startUtcISO: todayWindow.startUtcISO, 
    endUtcISO: todayWindow.endUtcISO, 
    activeTables: uniqueActiveTables 
  });

  return (
    <DashboardClient venueId={params.venueId} userId={user.id} activeTables={uniqueActiveTables} />
  );
}
