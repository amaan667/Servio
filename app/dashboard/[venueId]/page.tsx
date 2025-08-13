export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log, error } from '@/lib/debug';
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
    .from('venues').select('venue_id,name').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

  log('DASH SSR venue', { ok: !!venue, err: vErr?.message });
  if (vErr || !venue) return notFound();

  // Compute unique active tables (open tickets): status != 'delivered'
  const { data: activeRows } = await supabase
    .from('orders')
    .select('table_number, status')
    .eq('venue_id', params.venueId)
    .neq('status', 'delivered');
  const uniqueActiveTables = new Set((activeRows ?? []).map((r: any) => r.table_number).filter((t: any) => t != null)).size;

  return <DashboardClient venueId={params.venueId} userId={user.id} activeTables={uniqueActiveTables} />;
}
