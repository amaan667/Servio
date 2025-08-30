import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status') || 'all';
  const limit = parseInt(searchParams.get('limit') || '50');
  const scope = searchParams.get('scope') || 'today';

  if (!venueId) {
    return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Check venue ownership
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  let query = supabase
    .from('orders')
    .select(`
      id, venue_id, table_number, customer_name, customer_phone, 
      total_amount, status, payment_status, notes, created_at, items
    `)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply status filter
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Apply date scope filter
  if (scope === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte('created_at', today.toISOString());
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error('[DASHBOARD ORDERS] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Get active tables count for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: activeTables } = await supabase
    .from('orders')
    .select('table_number')
    .eq('venue_id', venueId)
    .gte('created_at', today.toISOString())
    .not('table_number', 'is', null);

  const activeTablesToday = new Set(activeTables?.map((o: any) => o.table_number) || []).size;

  return NextResponse.json({
    ok: true,
    orders: orders || [],
    meta: {
      activeTablesToday,
      total: orders?.length || 0
    }
  });
}