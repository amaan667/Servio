import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH DEBUG] Clearing auth tokens via API');
    
    const res = NextResponse.json({ success: true });
    
    // Clear all Supabase auth cookies
    const authCookies = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase-auth-refresh-token'
    ];
    
    authCookies.forEach(cookieName => {
      res.cookies.set(cookieName, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    });
    
    console.log('[AUTH DEBUG] Auth tokens cleared successfully');
    
    return res;
  } catch (error) {
    console.error('[AUTH DEBUG] Error clearing tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear tokens' },
      { status: 500 }
    );
  }
}
