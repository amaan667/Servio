import { NextResponse } from 'next/server';
import { getAuthRedirectUrl } from '@/lib/auth';

export async function GET() {
  const redirectUrl = getAuthRedirectUrl('/auth/callback');
  
  return NextResponse.json({
    authConfig: {
      redirectUrl,
      nodeEnv: process.env.NODE_ENV,
      nextPublicAppUrl: undefined,
      nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    },
    timestamp: new Date().toISOString(),
  });
}
