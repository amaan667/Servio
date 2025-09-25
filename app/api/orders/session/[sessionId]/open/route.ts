import { NextResponse } from 'next/server';
import { logInfo, logError } from "@/lib/logger";

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Session ID is required' 
      }, { status: 400 });
    }


    logInfo('[ORDERS SESSION] Looking for open order with session:', sessionId);

    // Since session_id column doesn't exist in database yet, we'll use localStorage approach
    // For now, return null to indicate no session-based order found
    // This will be handled client-side using localStorage
    const order = null;

    if (!order) {
      logInfo('[ORDERS SESSION] No open order found for session:', sessionId);
      return NextResponse.json({
        success: true,
        data: null
      });
    }

  } catch (error) {
    logError('[ORDERS SESSION] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
