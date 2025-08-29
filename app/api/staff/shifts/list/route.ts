import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venue_id = searchParams.get('venue_id');
  const staff_id = searchParams.get('staff_id');
  if (!venue_id) return NextResponse.json({ error: 'venue_id required' }, { status: 400 });

  const admin = await createClient();

  let q = admin.from('staff_shifts')
    .select('id, staff_id, venue_id, start_time, end_time, area')
    .eq('venue_id', venue_id)
    .order('start_time', { ascending: false });
  if (staff_id) q = q.eq('staff_id', staff_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, shifts: data ?? [] });
}


