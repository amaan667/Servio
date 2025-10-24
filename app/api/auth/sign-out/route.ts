import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST() {
  try {
    // Simply return success - let the client handle the actual sign-out
    const response = NextResponse.json({ ok: true });
    
    // Clear auth cookies by setting them to expire immediately
    const cookieOptions = {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const
    };
    
    response.cookies.set('sb-access-token', '', cookieOptions);
    response.cookies.set('sb-refresh-token', '', cookieOptions);
    response.cookies.set('supabase-auth-token', '', cookieOptions);
    
    return response;
  } catch (_error) {
    logger.error('[AUTH] Sign-out error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ ok: true }); // Always return success to avoid client errors
  }
}

