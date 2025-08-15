import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { order_id, rating, comment } = await req.json();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, key, { auth: { persistSession:false }});
    if (!order_id || !rating) {
      return NextResponse.json({ ok:false, error:'order_id and rating required' }, { status:400 });
    }
    const { error } = await admin.from('order_feedback').insert({ order_id, rating, comment: (comment||'').slice(0, 500) });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 });
  }
}
