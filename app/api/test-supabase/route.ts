import { NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase-server';

export async function GET() {
  try {
    console.log('[AUTH DEBUG] Testing Supabase configuration...');
    
    const supabase = createRouteSupabase();
    
    // Test basic connection
    const { data: sessionData, error: sessionError } = await (await supabase).auth.getSession();
    
    // Test basic query
    const { data: testData, error: testError } = await (await supabase)
      .from('venues')
      .select('count')
      .limit(1);
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      },
      supabase: {
        sessionTest: {
          success: !sessionError,
          error: sessionError?.message,
          hasSession: !!sessionData?.session,
        },
        queryTest: {
          success: !testError,
          error: testError?.message,
        }
      }
    };
    
    console.log('[AUTH DEBUG] Supabase test result:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AUTH DEBUG] Supabase test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
