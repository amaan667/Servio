import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Log immediately when endpoint is hit
  console.log('================================================================================');
  console.log('[DEMO ACCESS] API ENDPOINT HIT - Starting to process request');
  console.log('[DEMO ACCESS] Request URL:', req.url);
  console.log('[DEMO ACCESS] Content-Type:', req.headers.get('content-type'));
  console.log('================================================================================');
  
  try {
    // Get the raw body first
    const text = await req.text();
    console.log('[DEMO ACCESS] Raw body received:', text.substring(0, 200));
    
    // Parse the JSON
    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('[DEMO ACCESS ERROR] Failed to parse JSON:', parseError);
      console.error('[DEMO ACCESS ERROR] Body text:', text);
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
    console.log('================================================================================');
    console.log('[DEMO ACCESS] VIEW DEMO BUTTON CLICKED');
    console.log('[DEMO ACCESS] Timestamp:', timestamp || new Date().toISOString());
    console.log('[DEMO ACCESS] Action:', action || 'unknown');
    console.log('[DEMO ACCESS] View Mode:', viewMode || 'not set');
    console.log('[DEMO ACCESS] Source URL:', url || 'unknown');
    console.log('[DEMO ACCESS] Referrer:', referrer || 'direct');
    console.log('[DEMO ACCESS] User Agent:', userAgent ? userAgent.substring(0, 100) : 'unknown');
    if (user) {
      console.log('[DEMO ACCESS] User ID:', user.id || 'anonymous');
      console.log('[DEMO ACCESS] User Email:', user.email || 'no email');
    } else {
      console.log('[DEMO ACCESS] User: Anonymous (not logged in)');
    }
    console.log('================================================================================');

    return NextResponse.json({ 
      success: true,
      logged: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log('================================================================================');
    console.error('[DEMO ACCESS ERROR] Failed to process request');
    console.error('[DEMO ACCESS ERROR]', error);
    console.log('================================================================================');
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Add GET endpoint to test if route is accessible
export async function GET(req: Request) {
  console.log('================================================================================');
  console.log('[DEMO ACCESS] GET request received - API route is working');
  console.log('================================================================================');
  
  return NextResponse.json({ 
    message: 'Demo access logging API is operational',
    timestamp: new Date().toISOString()
  });
}

