import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Test OAuth configuration
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://servio-production.up.railway.app/auth/callback',
        queryParams: { prompt: 'select_account' },
      },
    });
    
    const debugInfo = {
      hasData: !!data,
      hasError: !!error,
      error: error?.message || null,
      url: data?.url || null,
      provider: data?.provider || null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(debugInfo);
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      stack: e.stack,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
