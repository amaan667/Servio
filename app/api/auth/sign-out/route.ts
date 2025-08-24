import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST() {
  const supa = supabaseServer();
  try {
    await supa.auth.signOut(); // clears session + auth cookies via SSR jar
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[AUTH] sign-out failed', e?.message || e);
    return NextResponse.json({ ok: false, error: 'sign_out_failed' }, { status: 500 });
  }
}


