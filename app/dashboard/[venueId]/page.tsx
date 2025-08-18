export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log, error } from '@/lib/debug';
import { todayWindowForTZ } from '@/lib/time';
import DashboardClient from './page.client';

export default async function Page({ params }: { params: { venueId: string } }) {
  console.log('[VENUE PAGE] params.venueId =', params.venueId);
  console.log('[DASHBOARD VENUE] Page function called with venueId:', params.venueId);
  
  const jar = await cookies();
  console.log('[DASHBOARD VENUE] Cookies jar created');
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  console.log('[DASHBOARD VENUE] Supabase client created');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[DASHBOARD VENUE] Auth getUser result:', { 
    hasUser: !!user, 
    userId: user?.id, 
    userError: userError?.message 
  });
  
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
    return notFound();
  }
  if (!venue) {
    console.log('[DASHBOARD VENUE] Venue not found - user may not have access or venue does not exist');
    return notFound();
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

  return <DashboardClient venueId={params.venueId} userId={user.id} activeTables={uniqueActiveTables} />;
}
