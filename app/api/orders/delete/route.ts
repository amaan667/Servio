import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { orderId, venue_id } = await req.json().catch(()=>({}));
  if (!orderId || !venue_id) return NextResponse.json({ ok:false, error:'orderId and venue_id required' }, { status:400 });
      const admin = await createClient();
  const { error } = await admin.from('orders').delete().eq('id', orderId).eq('venue_id', venue_id);
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:400 });
  return NextResponse.json({ ok:true });
}

