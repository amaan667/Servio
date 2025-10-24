import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(_req: Request) {
  try {
    
    const { orderId } = await req.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // First, get the order details to find venue_id and table_id
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('venue_id, table_id')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch order:', { value: fetchError });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update payment status
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'PAID',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      logger.error('Failed to mark order as paid:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this is a table order, check if reservations should be auto-completed
    if (order.table_id) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app';
        const completionResponse = await fetch(`${baseUrl}/api/reservations/check-completion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            venueId: order.venue_id,
            tableId: order.table_id
          }),
        });

        if (completionResponse.ok) {
          const completionResult = await completionResponse.json();
        }
      } catch (completionError) {
        logger.error('[MARK PAID] Error checking reservation completion:', { value: completionError });
        // Don't fail the main request if completion check fails
      }
    }

    
    return NextResponse.json({ 
      success: true,
      orderId,
      payment_status: 'PAID',
      updated_at: new Date().toISOString()
    });
  } catch (_error) {
    logger.error('[MARK PAID] Error marking order as paid:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

