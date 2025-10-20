import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venue_id = searchParams.get('venue_id');

  const admin = createAdminClient();
  try {
    // If venue_id is provided, return staff for that venue (excluding deleted staff)
    if (venue_id) {
      const { data, error } = await admin
        .from('staff')
        .select('*')
        .eq('venue_id', venue_id)
        .is('deleted_at', null)  // Only return non-deleted staff
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
  } catch (e:unknown) {
    return NextResponse.json({ ok:false, error: e instanceof Error ? e.message : 'Unknown error' }, { status:500 });
  }
}


