import { NextResponse } from 'next/server';
import { getSupabaseServerReadOnly } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = getSupabaseServerReadOnly();
    
    // Get session information
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Get user information if session exists
    let user = null;
    if (session?.user) {
      const { data: { user: userData }, error: userError } = await supabase.auth.getUser();
      user = userData;
    }
    
    return NextResponse.json({
      success: true,
      session: session ? {
        access_token: session.access_token ? '***' : null,
        refresh_token: session.refresh_token ? '***' : null,
        expires_at: session.expires_at,
        user: session.user ? {
          id: session.user.id,
          email: session.user.email,
          created_at: session.user.created_at,
        } : null,
      } : null,
      user,
      error: error?.message || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}