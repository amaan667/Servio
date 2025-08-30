import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthRedirectUrl } from '@/lib/auth';
import { cookies } from 'next/headers';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookieNames = cookieStore.getAll().map(c => c.name);
    const hasAuthCookies = hasSupabaseAuthCookies(cookieNames);
    
    let session = null;
    let sessionError = null;
    let oauthSettings = null;
    let oauthError = null;
    
    if (hasAuthCookies) {
      const supabase = await createClient();
      const sessionResult = await supabase.auth.getSession();
      session = sessionResult.data?.session;
      sessionError = sessionResult.error;
      
      const oauthResult = await supabase.auth.listIdentities();
      oauthSettings = oauthResult.data;
      oauthError = oauthResult.error;
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      auth: {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionError: sessionError?.message,
      },
      oauth: {
        redirectUrl: getAuthRedirectUrl('/auth/callback'),
        hasOAuthSettings: !!oauthSettings,
        oauthError: oauthError?.message,
      },
      request: {
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      }
    };
    
    console.log('[AUTH DEBUG] Debug endpoint called:', debugInfo);
    
    return NextResponse.json(debugInfo);
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] Debug endpoint error:', error.message);
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
