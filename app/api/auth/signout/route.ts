import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('[SIGNOUT API] Starting signout process');
    
    const supabase = await createServerSupabase();
    
    // First, try to get the current session to log what we're signing out
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('[SIGNOUT API] Error getting session:', sessionError.message);
    } else if (session) {
      console.log('[SIGNOUT API] Signing out user:', session.user.id);
    } else {
      console.log('[SIGNOUT API] No active session found');
    }
    
    // Perform the signout
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[SIGNOUT API] Supabase signout error:', error.message);
      return NextResponse.json({ 
        ok: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    console.log('[SIGNOUT API] Signout successful');
    
    // Create a response that clears cookies
    const response = NextResponse.json({ ok: true });
    
    // Explicitly clear auth cookies to ensure they're removed
    const authCookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase.auth.token',
      'supabase-auth-token'
    ];
    
    authCookieNames.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false
      });
    });
    
    return response;
    
  } catch (error: any) {
    console.error('[SIGNOUT API] Unexpected error:', error.message);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}
