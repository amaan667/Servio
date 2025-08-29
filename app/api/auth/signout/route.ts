import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    console.log('[AUTH DEBUG] Server-side sign out initiated');
    
    // Clear all Supabase-related cookies without triggering auth state changes
    const cookieOptions = {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const
    };
    
    // Clear all possible Supabase cookie names
    const supabaseCookieNames = [
      'sb-access-token',
      'sb-refresh-token', 
      'supabase-auth-token',
      'sb-auth-token',
      'supabase-auth-token-code-verifier'
    ];
    
    const response = NextResponse.json({ success: true });
    
    supabaseCookieNames.forEach(cookieName => {
      response.cookies.set(cookieName, '', cookieOptions);
    });
    
    console.log('[AUTH DEBUG] Server-side sign out successful - cookies cleared');
    
    return response;
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] Server-side sign out error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
