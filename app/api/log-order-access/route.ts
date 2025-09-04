import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Server-side logging for order page access
    console.log('🚨 ORDER PAGE ACCESSED VIA API 🚨');
    console.log('[ORDER PAGE SERVER] ===== ORDER PAGE ACCESSED =====');
    console.log('[ORDER PAGE SERVER] Timestamp:', new Date().toISOString());
    console.log('[ORDER PAGE SERVER] Venue slug:', body.venueSlug);
    console.log('[ORDER PAGE SERVER] Table number:', body.tableNumber);
    console.log('[ORDER PAGE SERVER] Is demo:', body.isDemo);
    console.log('[ORDER PAGE SERVER] User agent:', request.headers.get('user-agent'));
    console.log('[ORDER PAGE SERVER] Referer:', request.headers.get('referer'));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ORDER PAGE SERVER] Error logging access:', error);
    return NextResponse.json({ error: 'Failed to log access' }, { status: 500 });
  }
}
