import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    try {
      // Exchange the code for a session
      const { data, error } = await supabase?.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(new URL('/sign-in?error=oauth_failed', request.url));
      }

      if (data?.session) {
        // Successfully authenticated, redirect to dashboard
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch (error) {
      console.error('OAuth callback exception:', error);
      return NextResponse.redirect(new URL('/sign-in?error=oauth_failed', request.url));
    }
  }

  // No code provided, redirect to sign-in
  return NextResponse.redirect(new URL('/sign-in', request.url));
} 