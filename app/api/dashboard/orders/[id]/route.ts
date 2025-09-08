import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient();
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const { order_status, payment_status } = body as { order_status?: 'PLACED'|'IN_PREP'|'READY'|'COMPLETED'|'CANCELLED', payment_status?: 'UNPAID'|'PAID'|'REFUNDED' };
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  if (order_status && !['PLACED','IN_PREP','READY','COMPLETED','CANCELLED'].includes(order_status)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  const supa = await admin();
  const update: Record<string, any> = {};
  if (order_status) {
    update.order_status = order_status;
  }
  if (payment_status) update.payment_status = payment_status;
  const { data, error } = await supa
    .from('orders')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, order: data });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const supa = await admin();
  const { error } = await supa.from('orders').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


