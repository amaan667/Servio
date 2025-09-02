import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ ok:false, error:'Missing service role key' }, { status:500 });

  const { searchParams } = new URL(req.url);
  const venue_id = searchParams.get('venue_id');

  const admin = await createClient();
  try {
    // If venue_id is provided, return staff for that venue
    if (venue_id) {
      const { data, error } = await admin
        .from('staff')
        .select('*')
        .eq('venue_id', venue_id)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, exists: true, staff: data || [] });
    }

    // Otherwise, just check if table exists
    const { error } = await admin.from('staff').select('id').limit(1);
    if (error) {
      const missing = /Could not find the table 'public\.staff'/.test(error.message) || error.code === '42P01';
      return NextResponse.json({ ok:true, exists: !missing, error: error.message });
    }
    return NextResponse.json({ ok:true, exists:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Unknown error' }, { status:500 });
  }
}


