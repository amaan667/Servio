import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Demo Reset API
 * Resets demo data for the demo-cafe venue
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const demoVenueId = 'demo-cafe';
    
    // Delete all demo orders (older than 1 hour to preserve active demos)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .eq('venue_id', demoVenueId)
      .lt('created_at', oneHourAgo);
    
    if (ordersError) {
      logger.error('[DEMO RESET] Error deleting old orders:', ordersError);
    }
    
    // Clear demo table sessions (older than 1 hour)
    const { error: sessionsError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('venue_id', demoVenueId)
      .lt('created_at', oneHourAgo);
    
    if (sessionsError) {
      logger.error('[DEMO RESET] Error deleting old sessions:', sessionsError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Demo data reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[DEMO RESET] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset demo data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing
export async function GET(request: NextRequest) {
  return POST(request);
}