import { NextRequest, NextResponse } from 'next/server';
import { clearAuthTokens } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });
    clearAuthTokens(response);
    
    console.log('[AUTH DEBUG] API: Cleared auth tokens via API endpoint');
    
    return response;
  } catch (error) {
    console.error('[AUTH DEBUG] API: Error clearing tokens:', error);
    return NextResponse.json({ error: 'Failed to clear tokens' }, { status: 500 });
  }
}
