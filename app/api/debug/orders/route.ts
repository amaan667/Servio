import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { apiLogger as logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    logger.debug('[DEBUG ORDERS] Debug request for session:', sessionId);
    
    // Get all recent orders
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentOrders, error: recentError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) {
      logger.error('[DEBUG ORDERS] Error fetching recent orders:', recentError);
      return NextResponse.json({ 
        error: 'Failed to fetch orders',
        details: recentError.message 
      }, { status: 500 });
    }

    // If sessionId provided, try to find it specifically
    let matchingOrder = null;
    if (sessionId) {
      matchingOrder = recentOrders?.find(order => 
        order.stripe_session_id === sessionId
      );
    }

    return NextResponse.json({ 
      ok: true,
      sessionId,
      matchingOrder,
      recentOrders: recentOrders || [],
      count: recentOrders?.length || 0
    });

  } catch (error) {
    logger.error('[DEBUG ORDERS] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
