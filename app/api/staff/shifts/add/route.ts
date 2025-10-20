import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { venue_id, staff_id, start_time, end_time, area } = await req.json().catch(()=>({}));
  if (!venue_id || !staff_id || !start_time || !end_time) return NextResponse.json({ error:'Missing fields' }, { status:400 });
      const admin = createAdminClient();
  const { data, error } = await admin.from('staff_shifts').insert([{ venue_id, staff_id, start_time, end_time, area }]).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status:400 });
  return NextResponse.json({ ok:true, data });
}


