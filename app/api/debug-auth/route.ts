import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  try {
    console.log('[AUTH DEBUG] Debug auth endpoint called');
    
    const supabase = createServerSupabase();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Check environment variables
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
    };
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        expiresAt: session?.expires_at,
        error: sessionError?.message
      },
      user: {
        exists: !!user,
        userId: user?.id,
        userEmail: user?.email,
        error: userError?.message
      },
      environment: envInfo
    };
    
    console.log('[AUTH DEBUG] Debug auth response:', debugInfo);
    
    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('[AUTH DEBUG] Debug auth endpoint error:', error);
    return NextResponse.json({ 
      error: 'Debug auth endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
