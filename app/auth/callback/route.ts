import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (code) {
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(new URL('/sign-in?error=auth_callback_failed', request.url));
      }

      if (data.session) {
        // ALWAYS use Railway domain - never localhost
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
        
        const redirectUrl = `${baseUrl}${next}`;
        console.log('Auth callback redirecting to:', redirectUrl);
        
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Fallback redirect - also use Railway domain
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    return NextResponse.redirect(new URL('/sign-in', baseUrl));
  } catch (error) {
    console.error('Auth callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    return NextResponse.redirect(new URL('/sign-in?error=callback_error', baseUrl));
  }
}