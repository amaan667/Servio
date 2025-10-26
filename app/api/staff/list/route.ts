import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(_req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venue_id = searchParams.get('venue_id');

    if (!venue_id) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('staff')
      .select('*')
      .eq('venue_id', venue_id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, staff: data || [] });
  } catch (_e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
