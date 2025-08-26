import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = cookies();
    
    // Clear all auth-related cookies
    const authCookies = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase-auth-refresh-token'
    ];
    
    authCookies.forEach(cookieName => {
      cookieStore.set(cookieName, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    });
    
    console.log('[AUTH DEBUG] Cleared auth tokens via API');
    
    return NextResponse.json({
      success: true,
      message: 'Auth tokens cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AUTH DEBUG] Error clearing tokens:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to clear tokens',
    }, { status: 500 });
  }
}
