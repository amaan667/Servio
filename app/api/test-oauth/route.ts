import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // First, check if there's an existing session and clear it if needed
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('[AUTH DEBUG] Existing session found, signing out first');
      await supabase.auth.signOut();
    }
    
    // Clear any existing auth state
    console.log('[AUTH DEBUG] Starting fresh OAuth flow');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getBaseUrl()}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        },
        skipBrowserRedirect: false
      },
    });

    if (error) {
      console.log('[AUTH DEBUG] OAuth error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        code: error.status 
      });
    }

    console.log('[AUTH DEBUG] OAuth URL generated successfully');
    return NextResponse.json({ success: true, url: data.url });
  } catch (err: any) {
    console.log('[AUTH DEBUG] Unexpected error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      type: 'unexpected_error'
    });
  }
}
