import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Get user if session exists
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Check if there are any auth cookies
    const cookies = await supabase.auth.getSession();
    
    console.log('[AUTH DEBUG] Auth state check:', {
      hasSession: !!session,
      hasUser: !!user,
      sessionError: sessionError?.message,
      userError: userError?.message,
      userId: user?.id,
      userEmail: user?.email,
    });

    return NextResponse.json({
      success: true,
      data: {
        hasSession: !!session,
        hasUser: !!user,
        sessionError: sessionError?.message,
        userError: userError?.message,
        userId: user?.id,
        userEmail: user?.email,
        sessionExpiry: session?.expires_at,
        accessTokenExpiry: session?.access_token ? 'present' : 'missing',
        refreshToken: session?.refresh_token ? 'present' : 'missing',
      }
    });
  } catch (err: any) {
    console.log('[AUTH DEBUG] Auth state check error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    });
  }
}
