import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Create a test Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Test the OAuth configuration
    const redirectTo = 'https://servio-production.up.railway.app';

    console.log('[TEST-OAUTH] Testing Google OAuth configuration...');
    console.log('[TEST-OAUTH] Redirect URL:', redirectTo);
    console.log('[TEST-OAUTH] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('[TEST-OAUTH] Environment:', process.env.NODE_ENV);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      console.error('[TEST-OAUTH] OAuth error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error,
        redirectUrl: redirectTo,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        environment: process.env.NODE_ENV,
      }, { status: 400 });
    }

    console.log('[TEST-OAUTH] OAuth URL generated successfully');
    return NextResponse.json({
      success: true,
      url: data.url,
      provider: data.provider,
      redirectUrl: redirectTo,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      environment: process.env.NODE_ENV,
    });

  } catch (error: any) {
    console.error('[TEST-OAUTH] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
