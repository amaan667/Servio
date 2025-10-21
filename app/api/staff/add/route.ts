import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { venue_id, name, role } = body || {};

    if (!venue_id || !name) {
      return NextResponse.json({ error: 'venue_id and name are required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from('staff').insert([{ venue_id, name, role: role || 'Server' }]).select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}


