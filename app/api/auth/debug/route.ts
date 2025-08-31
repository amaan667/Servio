import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[AUTH DEBUG] Debug endpoint called');
    
    const supabase = await createServerSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set',
      },
      auth: {
        hasUser: !!user,
        hasSession: !!session,
        userError: userError?.message || null,
        sessionError: sessionError?.message || null,
        userId: user?.id || null,
        userEmail: user?.email || null,
        sessionExpiry: session?.expires_at || null,
      },
      headers: {
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent')?.substring(0, 100) + '...',
      }
    };
    
    console.log('[AUTH DEBUG] Debug info:', debugInfo);
    
    return NextResponse.json(debugInfo);
  } catch (error: any) {
    console.error('[AUTH DEBUG] Error in debug endpoint:', error);
    return NextResponse.json(
      { error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
