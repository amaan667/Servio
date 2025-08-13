import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const orderId = searchParams.get('orderId');
  if (!venueId || !orderId) {
    return NextResponse.json({ ok: false, error: 'venueId and orderId required' }, { status: 400 });
  }

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok:false, error:'Not authenticated' }, { status:401 });

  const { data: v } = await supabase
    .from('venues')
    .select('venue_id, owner_id')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!v) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ ok:false, error:'Missing service role' }, { status:500 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('venue_id', venueId)
    .maybeSingle();
  if (orderErr) return NextResponse.json({ ok:false, error: orderErr.message }, { status:500 });
  if (!order) return NextResponse.json({ ok:true, order: null });

  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (itemsErr) return NextResponse.json({ ok:false, error: itemsErr.message }, { status:500 });

  const mappedItems = (items ?? []).map((it: any) => {
    const price = Number(it.unit_price ?? it.price ?? 0);
    const qty = Number(it.quantity ?? 0);
    const line_total = price * qty;
    const item_name = (it.item_name ?? it.name ?? it.menu_item_name ?? 'Item') as string;
    return { id: it.id, item_name, price, quantity: qty, special_instructions: it.special_instructions, line_total };
  });
  const computed_total = mappedItems.reduce((s, it) => s + it.line_total, 0);
  return NextResponse.json({ ok:true, order: { ...order, items: mappedItems, computed_total } });
}


