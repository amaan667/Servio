import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthRedirectUrl } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Test OAuth configuration
    const redirectUrl = getAuthRedirectUrl('/auth/callback');
    
    // Test Supabase connection
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Test OAuth providers
    const { data: providers, error: providersError } = await supabase.auth.listIdentities();
    
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
        hasProviders: !!providers,
        providerCount: providers?.length || 0,
        providersError: providersError?.message,
      },
      request: {
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      }
    };
    
    console.log('[AUTH DEBUG] OAuth test results:', testResults);
    
    return NextResponse.json(testResults);
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] OAuth test error:', error.message);
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
