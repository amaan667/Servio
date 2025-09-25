import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { logInfo, logError } from "@/lib/logger";

export async function POST() {
  try {
    logInfo('[SIGNOUT API] Starting signout process');
    
    const supabase = await createServerSupabase();
    
    // SECURE: Use getUser() instead of getSession() for authentication check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      logInfo('[SIGNOUT API] Error getting user:', userError.message);
    } else if (user) {
      logInfo('[SIGNOUT API] Signing out user:', user.id);
    } else {
      logInfo('[SIGNOUT API] No authenticated user found');
    }
    
    // Perform the signout
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logError('[SIGNOUT API] Supabase signout error:', error.message);
      return NextResponse.json({ 
        ok: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    logInfo('[SIGNOUT API] Signout successful');
    
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
    logError('[SIGNOUT API] Unexpected error:', error.message);
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
