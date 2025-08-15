import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    
    console.log('[TEST-OAUTH-CONFIG] Environment check:', {
      supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
      supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING',
      siteUrl: siteUrl || 'MISSING',
      nodeEnv: process.env.NODE_ENV
    });

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        details: {
          supabaseUrl: !!supabaseUrl,
          supabaseAnonKey: !!supabaseAnonKey
        }
      }, { status: 400 });
    }

    // Create a test Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Test the OAuth configuration with the callback URL
    const redirectTo = 'https://servio-production.up.railway.app/auth/callback';
    
    console.log('[TEST-OAUTH-CONFIG] Testing Google OAuth with redirect:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      console.error('[TEST-OAUTH-CONFIG] OAuth error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: {
          message: error.message,
          status: error.status,
          name: error.name,
          redirectTo,
          supabaseUrl: supabaseUrl.substring(0, 20) + '...',
          environment: process.env.NODE_ENV
        }
      }, { status: 400 });
    }

    console.log('[TEST-OAUTH-CONFIG] OAuth URL generated successfully');
    return NextResponse.json({
      success: true,
      url: data.url,
      provider: data.provider,
      redirectTo,
      environment: process.env.NODE_ENV,
      supabaseUrl: supabaseUrl.substring(0, 20) + '...'
    });

  } catch (error: any) {
    console.error('[TEST-OAUTH-CONFIG] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}