import { NextResponse } from "next/server";

export async function GET() {
  try {
    const envCheck = {
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
      },
      app: {
        url: process.env.NEXT_PUBLIC_APP_URL || 'Not set',
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'Not set',
        nodeEnv: process.env.NODE_ENV || 'Not set',
      },
      oauth: {
        googleClientId: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      }
    };

    console.log('[AUTH DEBUG] Environment check:', envCheck);

    return NextResponse.json({
      success: true,
      data: envCheck,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.log('[AUTH DEBUG] Environment check error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    });
  }
}