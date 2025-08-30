import { NextResponse } from "next/server";
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET() {
  try {
    console.log('[AUTH DEBUG] Starting OAuth flow from server');
    
    // Instead of initiating OAuth server-side, redirect to a client-side page
    // that will handle the OAuth flow properly with PKCE
    const redirectUrl = `${getBaseUrl()}/test-oauth-simple`;
    
    console.log('[AUTH DEBUG] Redirecting to client-side OAuth:', redirectUrl);
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.log('[AUTH DEBUG] Unexpected error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      type: 'unexpected_error'
    });
  }
}
