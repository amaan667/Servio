import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orderId, sessionId, venueId } = await req.json();
    
    if (!orderId || !sessionId || !venueId) {
      return NextResponse.json({ 
        error: 'orderId, sessionId, and venueId are required' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // Find the most recent UNPAID order for this venue that matches the criteria
    const { data: order, error: findError } = await supabase
      .from('orders')
      .select('id')
      .eq('venue_id', venueId)
      .eq('payment_status', 'UNPAID')
      .eq('payment_method', 'stripe')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !order) {
      logger.error('[UPDATE SESSION] Order not found:', findError);
      return NextResponse.json({ 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Update the order with the session ID
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        stripe_session_id: sessionId,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      logger.error('[UPDATE SESSION] Error updating order:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update order' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error) {
    logger.error('[UPDATE SESSION] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
