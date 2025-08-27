import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthRedirectUrl } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  const debugInfo = {
    authRedirectUrl: getAuthRedirectUrl('/auth/callback'),
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    timestamp: new Date().toISOString(),
    cookies: {
      all: allCookies.map(c => ({ name: c.name, value: c.value?.substring(0, 50) + '...' })),
      authCookies: allCookies.filter(c => c.name.includes('auth') || c.name.startsWith('sb-')).map(c => ({ name: c.name, value: c.value?.substring(0, 50) + '...' })),
      supabaseCookies: allCookies.filter(c => c.name.startsWith('sb-')).map(c => ({ name: c.name, value: c.value?.substring(0, 50) + '...' }))
    }
  };

  return NextResponse.json(debugInfo);
}
