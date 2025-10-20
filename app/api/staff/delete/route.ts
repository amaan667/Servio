import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { id } = await req.json().catch(()=>({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const admin = createAdminClient();

  // Use soft deletion instead of hard deletion for forever count
  const { error } = await admin
    .from('staff')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


