import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    console.log('📱 [QR SCAN] ========================================');
    console.log('📱 [QR SCAN] New QR code scan detected!');
    console.log('📱 [QR SCAN] Server Timestamp:', new Date().toISOString());
    
    const body = await req.json();
    
    console.log('📱 [QR SCAN] Venue Slug:', body.venueSlug);
    console.log('📱 [QR SCAN] Table Number:', body.tableNumber);
    console.log('📱 [QR SCAN] Counter Number:', body.counterNumber);
    console.log('📱 [QR SCAN] Order Type:', body.orderType);
    console.log('📱 [QR SCAN] Is Demo:', body.isDemo);
    console.log('📱 [QR SCAN] Full URL:', body.url);
    console.log('📱 [QR SCAN] User Agent:', body.userAgent?.substring(0, 100));
    console.log('📱 [QR SCAN] Client Timestamp:', body.timestamp);
    console.log('📱 [QR SCAN] ========================================');
    
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
  } catch (error) {
    console.error('❌ [QR SCAN] Error logging:', error);
    logger.error('❌ [QR SCAN - SERVER] Failed to log QR scan', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

