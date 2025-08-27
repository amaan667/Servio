import { NextResponse } from 'next/server';
import { getAuthRedirectUrl } from '@/lib/auth';

export async function GET() {
  const debugInfo = {
    authRedirectUrl: getAuthRedirectUrl('/auth/callback'),
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(debugInfo);
}
