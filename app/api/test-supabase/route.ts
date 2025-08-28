import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    console.log('[AUTH DEBUG] Testing Supabase configuration...');
    
    const supabase = createClient();
    
    // Test basic connection
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Test basic query
    const { data: testData, error: testError } = await supabase
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
        clientExists: !!supabase,
        authExists: !!(supabase && supabase.auth),
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
