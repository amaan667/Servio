import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Get the debug info from the request body
    const debugInfo = await req.json();
    
    // Log the debug info
    console.log('[AUTH][API DEBUG] Client-side PKCE state:', debugInfo);
    
    // Return a success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AUTH][API DEBUG] Error logging PKCE state:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
