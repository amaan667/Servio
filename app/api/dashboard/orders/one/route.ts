export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { todayWindowForTZ } from '@/lib/time';

type OrderRow = {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
  items: any[];                    // jsonb[]
  total_amount: number;
  created_at: string;              // timestamptz
  status: 'pending' | 'preparing' | 'served' | 'delivered' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const venueId = url.searchParams.get('venueId');
    // scope: 'all' (today, all statuses) | 'live' (today, pending/preparing) | 'history' (before today)
    const scope = (url.searchParams.get('scope') || 'all') as 'all' | 'live' | 'history';

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }

    // SSR supabase client (uses user cookies for RLS)
    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    // find venue tz
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('timezone')
      .eq('venue_id', venueId)
      .maybeSingle();

    if (vErr) {
      return NextResponse.json({ ok: false, error: vErr.message }, { status: 500 });
    }

    const { startUtcISO, endUtcISO, zone } = todayWindowForTZ(venue?.timezone);

    // base query: always sort by created_at DESC  ✅ (Requirement #2)
    let q = supabase
      .from('orders')
      .select(
        'id, venue_id, table_number, customer_name, items, total_amount, created_at, status, payment_status'
      )
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (scope === 'all') {
      // Today only, ALL statuses  ✅ (Requirement #3)
      q = q.gte('created_at', startUtcISO).lt('created_at', endUtcISO);
    } else if (scope === 'live') {
      // optional: live view (today + active)
      q = q
        .gte('created_at', startUtcISO)
        .lt('created_at', endUtcISO)
        .in('status', ['pending', 'preparing']);
    } else if (scope === 'history') {
      // before today
      q = q.lt('created_at', startUtcISO).limit(500);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: { scope, zone, startUtcISO, endUtcISO, count: data?.length ?? 0 },
      orders: (data || []) as OrderRow[],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}