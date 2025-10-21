import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    
    const { session, error } = await getSession();
    
    if (error) {
      logger.error('[REFRESH API] Error getting session:', { error });
      return NextResponse.json({ 
        ok: false, 
        error
      }, { status: 401 });
    }
    
    if (!session) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No session available' 
      }, { status: 401 });
    }
    
    
    return NextResponse.json({ 
      ok: true, 
      session: {
        user: session.user,
        expires_at: session.expires_at
      }
    });
    
  } catch (error: any) {
    logger.error('[REFRESH API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}