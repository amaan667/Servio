import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Log QR scan to server logs (will appear in Railway)
    logger.info('🔍 [QR SCAN - SERVER] Order page accessed via QR code', {
      venueSlug: body.venueSlug,
      tableNumber: body.tableNumber,
      counterNumber: body.counterNumber,
      orderType: body.orderType,
      isDemo: body.isDemo,
      url: body.url,
      userAgent: body.userAgent?.substring(0, 200),
      timestamp: new Date().toISOString(),
      clientTimestamp: body.timestamp
    });

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error('❌ [QR SCAN - SERVER] Failed to log QR scan', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

