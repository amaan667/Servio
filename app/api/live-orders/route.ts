import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');

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

  // Get live orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, venue_id, table_number, customer_name, customer_phone, 
      total_amount, status, payment_status, notes, created_at, items
    `)
    .eq('venue_id', venueId)
    .in('status', ['pending', 'preparing', 'ready'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[LIVE ORDERS] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orders: orders || []
  });
}