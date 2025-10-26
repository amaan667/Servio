import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAuthRedirectUrl } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Test OAuth configuration
    const redirectUrl = getAuthRedirectUrl('/auth/callback');
    
    // Test Supabase connection
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    const testResults = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      oauth: {
        redirectUrl,
        expectedRedirectUrl: 'https://servio-production.up.railway.app/auth/callback',
        redirectUrlMatches: redirectUrl === 'https://servio-production.up.railway.app/auth/callback',
      },
      auth: {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionError: sessionError?.message,
      },
      providers: {
        hasProviders: false,
        providerCount: 0,
        providersError: 'OAuth provider testing disabled',
      },
      request: {
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      }
    };
    
    
    return NextResponse.json(testResults);
    
  } catch (_error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
