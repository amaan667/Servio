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
        // Determine the correct redirect URL
        const isProduction = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
        const baseUrl = isProduction && process.env.NEXT_PUBLIC_SITE_URL 
          ? process.env.NEXT_PUBLIC_SITE_URL 
          : request.nextUrl.origin;
        
        const redirectUrl = `${baseUrl}${next}`;
        console.log('Auth callback redirecting to:', redirectUrl);
        
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Fallback redirect
    return NextResponse.redirect(new URL('/sign-in', request.url));
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/sign-in?error=callback_error', request.url));
  }
} 