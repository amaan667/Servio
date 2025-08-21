export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export async function GET(req: NextRequest) {
  console.log('[AUTH] Sign-out route called');
  
  try {
    const supabase = createServerSupabaseClient();
    
    console.log('[AUTH] Signing out user');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[AUTH] Sign out error:', error);
    } else {
      console.log('[AUTH] Sign out successful');
    }

    // Redirect to sign-in page
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    const redirectUrl = new URL('/sign-in?signedOut=true', base);
    
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('[AUTH] Unexpected error in sign-out:', error);
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    return NextResponse.redirect(new URL('/sign-in?signedOut=true', base));
  }
}
