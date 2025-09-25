import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Server-side logging for order page access
    logInfo('🚨 ORDER PAGE ACCESSED VIA API 🚨');
    logInfo('[ORDER PAGE SERVER] ===== ORDER PAGE ACCESSED =====');
    logInfo('[ORDER PAGE SERVER] Timestamp:', new Date().toISOString());
    logInfo('[ORDER PAGE SERVER] Venue slug:', body.venueSlug);
    logInfo('[ORDER PAGE SERVER] Table number:', body.tableNumber);
    logInfo('[ORDER PAGE SERVER] Is demo:', body.isDemo);
    logInfo('[ORDER PAGE SERVER] User agent:', request.headers.get('user-agent'));
    logInfo('[ORDER PAGE SERVER] Referer:', request.headers.get('referer'));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('[ORDER PAGE SERVER] Error logging access:', error);
    return NextResponse.json({ error: 'Failed to log access' }, { status: 500 });
  }
}
