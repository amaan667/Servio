import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      action, 
      viewMode, 
      url, 
      referrer,
      timestamp,
      userAgent 
    } = body;

    // Log to Railway console
    console.log('='.repeat(80));
    console.log('[DEMO ACCESS] Demo page accessed');
    console.log('[DEMO ACCESS] Timestamp:', timestamp || new Date().toISOString());
    console.log('[DEMO ACCESS] Action:', action || 'page_load');
    console.log('[DEMO ACCESS] View Mode:', viewMode || 'not set');
    console.log('[DEMO ACCESS] URL:', url);
    console.log('[DEMO ACCESS] Referrer:', referrer || 'direct');
    console.log('[DEMO ACCESS] User Agent:', userAgent || 'unknown');
    console.log('='.repeat(80));

    return NextResponse.json({ 
      success: true,
      logged: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DEMO ACCESS ERROR]', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

