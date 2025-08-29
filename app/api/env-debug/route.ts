import { NextResponse } from 'next/server';

export async function GET() {
  const envInfo = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    appUrl: process.env.APP_URL,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    allEnvVars: Object.keys(process.env).filter(key => 
      key.includes('URL') || key.includes('SITE') || key.includes('APP') || key.includes('SUPABASE')
    ).reduce((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {} as Record<string, string | undefined>)
  };

  console.log('[AUTH DEBUG] Server-side environment debug info:', envInfo);

  return NextResponse.json(envInfo);
}
