export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = false;

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  console.log('[AUTH] Sign-out route called');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    console.log('[AUTH] Signing out user');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[AUTH] Sign out error:', error);
    } else {
      console.log('[AUTH] Sign out successful');
    }

    // Redirect to sign-in page
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    const redirectUrl = new URL('/sign-in?signedOut=true', base || 'https://servio-production.up.railway.app');
    
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('[AUTH] Unexpected error in sign-out:', error);
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    return NextResponse.redirect(new URL('/sign-in?signedOut=true', base || 'https://servio-production.up.railway.app'));
  }
}
