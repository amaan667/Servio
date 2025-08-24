import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST() {
  const supa = supabaseServer();
  try {
    console.log('[AUTH DEBUG] Clear session initiated');
    
    // Clear server-side session
    const { error } = await supa.auth.signOut();
    
    if (error) {
      console.error('[AUTH DEBUG] Server session clear error:', error);
    } else {
      console.log('[AUTH DEBUG] Server session cleared successfully');
    }
    
    // Create response with cleared cookies
    const response = NextResponse.json({ 
      ok: true, 
      message: 'Session cleared successfully',
      timestamp: new Date().toISOString()
    });
    
    // Clear all possible auth-related cookies
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    response.cookies.delete('supabase-auth-token');
    response.cookies.delete('supabase-auth-token');
    response.cookies.delete('servio-auth-token');
    
    // Also clear any other potential cookie names
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token', 
      'supabase-auth-token',
      'servio-auth-token',
      'auth-token',
      'session-token'
    ];
    
    cookieNames.forEach(name => {
      response.cookies.delete(name);
    });
    
    console.log('[AUTH DEBUG] Session clear completed with cookie cleanup');
    return response;
  } catch (e: any) {
    console.error('[AUTH DEBUG] clear session failed', e?.message || e);
    return NextResponse.json({ ok: false, error: 'clear_session_failed' }, { status: 500 });
  }
}