import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Test basic connectivity
    const { data, error } = await supabase.auth.getSession();
    
    return NextResponse.json({
      success: true,
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      error: error?.message,
      timestamp: new Date().toISOString(),
      config: {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        urlPrefix: supabaseUrl.substring(0, 20) + '...'
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Authentication test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}