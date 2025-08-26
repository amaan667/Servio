import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envVars = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      nodeEnv: process.env.NODE_ENV,
    };

    // Check if the OAuth redirect URLs are properly configured
    const expectedRedirectUrl = 'https://servio-production.up.railway.app/api/auth/callback';
    const clientRedirectUrl = 'https://servio-production.up.railway.app/auth/callback';

    return NextResponse.json({
      success: true,
      environment: envVars,
      oauth: {
        expectedServerRedirectUrl: expectedRedirectUrl,
        expectedClientRedirectUrl: clientRedirectUrl,
        googleOAuthRedirectUrl: 'https://servio-production.up.railway.app/api/auth/callback',
      },
      recommendations: [
        'Ensure Google OAuth redirect URL is set to: https://servio-production.up.railway.app/api/auth/callback',
        'Check that Supabase OAuth settings include the correct redirect URLs',
        'Verify environment variables are set correctly in Railway',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}
