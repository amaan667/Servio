import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { id, active } = await req.json().catch(()=>({}));
  if (!id || typeof active !== 'boolean') return NextResponse.json({ error:'id and active required' }, { status:400 });
  const admin = createAdminClient();
  const { error } = await admin.from('staff').update({ active }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status:400 });
  return NextResponse.json({ ok:true });
}


