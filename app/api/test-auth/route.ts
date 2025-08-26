import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Test environment variables
    const envCheck = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    };

    // Test Supabase connection
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Test database connection
    const { data: testData, error: dbError } = await supabase
      .from('venues')
      .select('count')
      .limit(1);

    return NextResponse.json({
      ok: true,
      envCheck,
      session: {
        hasSession: !!sessionData.session,
        error: sessionError?.message,
      },
      database: {
        connected: !dbError,
        error: dbError?.message,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}