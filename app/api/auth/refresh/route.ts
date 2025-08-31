import { NextResponse } from 'next/server';
import { refreshSession } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('[REFRESH API] Starting session refresh');
    
    const { session, error } = await refreshSession();
    
    if (error) {
      console.error('[REFRESH API] Error refreshing session:', error);
      return NextResponse.json({ 
        ok: false, 
        error: error 
      }, { status: 401 });
    }
    
    if (!session) {
      console.log('[REFRESH API] No session returned from refresh');
      return NextResponse.json({ 
        ok: false, 
        error: 'No session available' 
      }, { status: 401 });
    }
    
    console.log('[REFRESH API] Session refreshed successfully for user:', session.user.id);
    
    return NextResponse.json({ 
      ok: true, 
      session: {
        user: session.user,
        expires_at: session.expires_at
      }
    });
    
  } catch (error: any) {
    console.error('[REFRESH API] Unexpected error:', error.message);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}