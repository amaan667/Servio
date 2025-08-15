import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

const Body = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { orderId, rating, comment } = Body.parse(json);
    const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});
    const { data: order, error } = await admin
      .from('orders').select('id, venue_id').eq('id', orderId).maybeSingle();
    if (error || !order) return NextResponse.json({ ok:false, error: error?.message || 'Order not found' }, { status:404 });
    const { error: insErr } = await admin.from('reviews').insert({
      order_id: orderId,
      venue_id: order.venue_id,
      rating,
      comment: (comment ?? '').slice(0, 500),
    });
    if (insErr) return NextResponse.json({ ok:false, error: insErr.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status:400 });
  }
}


