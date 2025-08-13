import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ ok:false, error:'Missing service role key' }, { status:500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
  try {
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


