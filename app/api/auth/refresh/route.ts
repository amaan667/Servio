export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';

export async function POST() {
  try {
    
    const { session, error } = await refreshSession();
    
    if (error) {
      const errorMessage = (error && typeof error === 'object' && 'message' in error) ? (error as Error).message : 'Unknown error';
      logger.error('[REFRESH API] Error refreshing session:', { error: errorMessage });
      return NextResponse.json({ 
        ok: false, 
        error: errorMessage
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
    
  } catch (error: unknown) {
    logger.error('[REFRESH API] Unexpected error:', getErrorMessage(error));
    return NextResponse.json({ 
      ok: false, 
      error: getErrorMessage(error) || 'Internal server error'
    }, { status: 500 });
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}