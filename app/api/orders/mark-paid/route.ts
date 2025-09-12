import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    console.log('[MARK PAID] ===== MARK ORDER AS PAID API CALLED =====');
    console.log('[MARK PAID] Request received at:', new Date().toISOString());
    
    const { orderId } = await req.json();
    console.log('[MARK PAID] Order ID:', orderId);
    
    if (!orderId) {
      console.log('[MARK PAID] ERROR: Order ID is required');
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
      console.error('Failed to fetch order:', fetchError);
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
      console.error('Failed to mark order as paid:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this is a table order, check if reservations should be auto-completed
    if (order.table_id) {
      try {
        const completionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reservations/check-completion`, {
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
          console.log('[MARK PAID] Auto-completion check result:', completionResult);
        }
      } catch (completionError) {
        console.error('[MARK PAID] Error checking reservation completion:', completionError);
        // Don't fail the main request if completion check fails
      }
    }

    console.log('[MARK PAID] Successfully marked order as paid:', orderId);
    console.log('[MARK PAID] ===== MARK ORDER AS PAID COMPLETED SUCCESSFULLY =====');
    
    return NextResponse.json({ 
      success: true,
      orderId,
      payment_status: 'PAID',
      updated_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[MARK PAID] Error marking order as paid:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


