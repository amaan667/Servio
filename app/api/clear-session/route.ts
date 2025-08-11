import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const cookieStore = cookies();
    
    // Clear all Supabase auth cookies
    const authCookies = [
      'sb-cpwemmofzjfzbmqcgjrq-auth-token',
      'sb-cpwemmofzjfzbmqcgjrq-auth-token.0',
      'sb-cpwemmofzjfzbmqcgjrq-auth-token.1',
      'supabase-auth-token',
      'supabase.auth.token',
    ];
    
    authCookies.forEach(name => {
      cookieStore.set(name, '', { 
        expires: new Date(0),
        path: '/',
        domain: '.up.railway.app',
        secure: true,
        httpOnly: true,
        sameSite: 'lax'
      });
      
      // Also clear without domain
      cookieStore.set(name, '', { 
        expires: new Date(0),
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax'
      });
    });
    
    return NextResponse.json({ success: true, message: 'Session cleared' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
