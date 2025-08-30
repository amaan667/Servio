import { NextResponse } from "next/server";
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET() {
  try {
    console.log('[AUTH DEBUG] Starting OAuth flow from server');
    
    // Redirect to home page where users can sign in
    const redirectUrl = `${getBaseUrl()}/`;
    
    console.log('[AUTH DEBUG] Redirecting to home page:', redirectUrl);
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
