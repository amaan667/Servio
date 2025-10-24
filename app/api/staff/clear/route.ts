import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(_req: Request) {
  const { venue_id } = await req.json().catch(()=>({}));
  if (!venue_id) return NextResponse.json({ error: 'venue_id required' }, { status: 400 });
  const admin = createAdminClient();

  const { error } = await admin.from('staff').delete().eq('venue_id', venue_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

