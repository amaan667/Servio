import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !['pending', 'preparing', 'served'].includes(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  // Map to DB domain values (served -> delivered)
  const dbStatus = status === 'served' ? 'delivered' : status;
  const { data, error } = await supabase
    .from('orders')
    .update({ status: dbStatus as any })
    .eq('id', orderId)
    .select('id,status,venue_id');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, order: data?.[0] ?? null });
}


