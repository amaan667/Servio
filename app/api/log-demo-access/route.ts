import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request) {
  // Log immediately when endpoint is hit
  logger.debug('================================================================================');
  logger.debug('[DEMO ACCESS] API ENDPOINT HIT - Starting to process request');
  logger.debug('[DEMO ACCESS] Request URL:', req.url);
  logger.debug('[DEMO ACCESS] Content-Type:', req.headers.get('content-type'));
  logger.debug('================================================================================');
  
  try {
    // Get the raw body first
    const text = await req.text();
    logger.debug('[DEMO ACCESS] Raw body received:', { data: text.substring(0, 200) });
    
    // Parse the JSON
    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      logger.error('[DEMO ACCESS ERROR] Failed to parse JSON:', { value: parseError });
      logger.error('[DEMO ACCESS ERROR] Body text:', { value: text });
      throw parseError;
    }
    
    const { 
      action, 
      viewMode, 
      url, 
      referrer,
      timestamp,
      userAgent,
      user 
    } = body;

    // Log to Railway console with clear formatting
    logger.debug('================================================================================');
    logger.debug('[DEMO ACCESS] VIEW DEMO BUTTON CLICKED');
    logger.debug('[DEMO ACCESS] Timestamp:', timestamp || new Date().toISOString());
    logger.debug('[DEMO ACCESS] Action:', action || 'unknown');
    logger.debug('[DEMO ACCESS] View Mode:', viewMode || 'not set');
    logger.debug('[DEMO ACCESS] Source URL:', url || 'unknown');
    logger.debug('[DEMO ACCESS] Referrer:', referrer || 'direct');
    logger.debug('[DEMO ACCESS] User Agent:', { data: userAgent ? userAgent.substring(0, 100) : 'unknown' });
    if (user) {
      logger.debug('[DEMO ACCESS] User ID:', user.id || 'anonymous');
      logger.debug('[DEMO ACCESS] User Email:', user.email || 'no email');
    } else {
      logger.debug('[DEMO ACCESS] User: Anonymous (not logged in)');
    }
    logger.debug('================================================================================');

    return NextResponse.json({ 
      success: true,
      logged: true,
      timestamp: new Date().toISOString()
    });

  } catch (_error) {
    logger.debug('================================================================================');
    logger.error('[DEMO ACCESS ERROR] Failed to process request');
    logger.error('[DEMO ACCESS ERROR]', { error: error instanceof Error ? error.message : 'Unknown error' });
    logger.debug('================================================================================');
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Add GET endpoint to test if route is accessible
export async function GET(_req: Request) {
  logger.debug('================================================================================');
  logger.debug('[DEMO ACCESS] GET request received - API route is working');
  logger.debug('================================================================================');
  
  return NextResponse.json({ 
    message: 'Demo access logging API is operational',
    timestamp: new Date().toISOString()
  });
}

