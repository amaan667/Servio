import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const envVars = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      debugAuth: process.env.NEXT_PUBLIC_DEBUG_AUTH,
    };

    // If action is 'test-session', try to get the current session
    if (action === 'test-session') {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        return NextResponse.json({
          success: true,
          environment: envVars,
          session: {
            hasSession: !!session,
            userId: session?.user?.id,
            userEmail: session?.user?.email,
            expiresAt: session?.expires_at,
          },
          error: error?.message,
          timestamp: new Date().toISOString(),
        });
      } catch (sessionError: any) {
        return NextResponse.json({
          success: false,
          environment: envVars,
          sessionError: sessionError.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      environment: envVars,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}
