import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST() {
  const supa = supabaseServer();
  try {
    console.log('[AUTH DEBUG] Sign-out initiated');
    
    // Clear server-side session
    const { error } = await supa.auth.signOut();
    
    if (error) {
      console.error('[AUTH DEBUG] Server sign-out error:', error);
    } else {
      console.log('[AUTH DEBUG] Server sign-out successful');
    }
    
    // Create response with cleared cookies
    const response = NextResponse.json({ ok: true });
    
    // Clear any auth-related cookies
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    response.cookies.delete('supabase-auth-token');
    
    console.log('[AUTH DEBUG] Sign-out completed with cookie cleanup');
    return response;
  } catch (e: any) {
    console.error('[AUTH DEBUG] sign-out failed', e?.message || e);
    return NextResponse.json({ ok: false, error: 'sign_out_failed' }, { status: 500 });
  }
}


