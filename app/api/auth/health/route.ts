import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabase();

    // Check for auth cookies
    const authCookies = cookieStore.getAll().filter(cookie =>
      cookie.name.includes('sb-') || cookie.name.includes('auth')
    );

    // Try to get session
    let sessionStatus = 'unknown';
    let sessionError = null;
    let userId = null;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        sessionStatus = 'error';
        sessionError = error.message;
      } else if (session) {
        sessionStatus = 'active';
        userId = session.user?.id;
      } else {
        sessionStatus = 'none';
      }
    } catch (err: unknown) {
      sessionStatus = 'exception';
      sessionError = err.message;
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      auth: {
        sessionStatus,
        hasUser: !!userId,
        userId: userId?.substring(0, 8) + '...',
        sessionError,
        authCookiesCount: authCookies.length,
        authCookies: authCookies.map(c => ({ name: c.name, hasValue: !!c.value }))
      },
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'
      },
      urls: {
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        appUrl: process.env.NEXT_PUBLIC_APP_URL
      }
    });
  } catch (error: unknown) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}
