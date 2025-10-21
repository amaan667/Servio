import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const errorData = await req.json();
    
    // Log client-side errors for monitoring
    logger.error('[CLIENT_ERROR]', {
      message: errorData.message,
      url: errorData.url,
      stack: errorData.stack?.substring(0, 500), // Limit stack trace length
      context: errorData.context,
    });
    
    return NextResponse.json({ success: true });
  } catch {
    // Silent error handling - don't break client if error logging fails
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

