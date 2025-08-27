import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test basic connection
    const { data, error } = await supabase.auth.getSession();
    
    return NextResponse.json({
      success: true,
      hasSession: !!data.session,
      error: error?.message || null,
      supabaseUrl: supabaseUrl.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
