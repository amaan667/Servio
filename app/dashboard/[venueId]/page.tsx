export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log, error } from '@/lib/debug';
import { todayWindowForTZ } from '@/lib/time';
import DashboardClient from './page.client';

export default async function Page({ params }: { params: { venueId: string } }) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('DASH SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  const { data: venue, error: vErr } = await supabase
    .from('venues').select('venue_id,name,timezone').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

  log('DASH SSR venue', { ok: !!venue, err: vErr?.message });
  if (vErr || !venue) return notFound();

  // Get timezone-aware today window
  const todayWindow = todayWindowForTZ(venue.timezone);
  
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
