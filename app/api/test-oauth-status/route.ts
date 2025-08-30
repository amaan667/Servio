import { NextResponse } from "next/server";

export async function GET() {
  try {
    const status = {
      oauth: {
        status: 'working',
        callback: 'receiving codes',
        pkce: 'client-side exchange enabled',
        timestamp: new Date().toISOString()
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      urls: {
        baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'Not set',
        callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}/auth/callback`
      }
    };

    console.log('[AUTH DEBUG] OAuth status check:', status);

    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (err: any) {
    console.log('[AUTH DEBUG] Status check error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    });
  }
}
