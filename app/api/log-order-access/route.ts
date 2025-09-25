import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Server-side logging for order page access
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ORDER PAGE SERVER] Error logging access:', error);
    return NextResponse.json({ error: 'Failed to log access' }, { status: 500 });
  }
}
