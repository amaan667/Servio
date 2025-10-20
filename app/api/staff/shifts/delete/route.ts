import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { id } = await req.json().catch(()=>({}));
  if (!id) return NextResponse.json({ error:'id required' }, { status:400 });
      const admin = await createClient();
  const { error } = await admin.from('staff_shifts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status:400 });
  return NextResponse.json({ ok:true });
}


