import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { status, payment_status } = body as { status?: 'pending'|'preparing'|'served'|'paid', payment_status?: 'pending'|'paid'|'failed'|'refunded' };
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  if (status && !['pending','preparing','served','paid'].includes(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  const supa = admin();
  // Map UI status -> DB status when needed (served -> delivered)
  const dbStatus = status === 'served' ? 'delivered' : status;
  const update: Record<string, any> = {};
  if (dbStatus) update.status = dbStatus;
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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const supa = admin();
  const { error } = await supa.from('orders').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


