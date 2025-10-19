import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Cron job to automatically reset demo data every few hours
 * This endpoint should be called by a cron service (e.g., Vercel Cron, Railway Cron)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET || 'demo-reset-secret';
    
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const demoVenueId = 'demo-cafe';
    
    // Delete demo orders older than 3 hours
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    const { data: deletedOrders, error: ordersError } = await supabase
      .from('orders')
      .delete()
      .eq('venue_id', demoVenueId)
      .lt('created_at', threeHoursAgo)
      .select('id');
    
    const ordersDeleted = deletedOrders?.length || 0;
    
    // Delete demo table sessions older than 3 hours
    const { data: deletedSessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('venue_id', demoVenueId)
      .lt('created_at', threeHoursAgo)
      .select('id');
    
    const sessionsDeleted = deletedSessions?.length || 0;
    
    apiLogger.debug('[DEMO RESET CRON] Completed:', {
      ordersDeleted,
      sessionsDeleted,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      ordersDeleted,
      sessionsDeleted,
      timestamp: new Date().toISOString(),
      errors: {
        orders: ordersError?.message || null,
        sessions: sessionsError?.message || null,
      }
    });
  } catch (error) {
    apiLogger.error('[DEMO RESET CRON] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to run demo reset cron',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}