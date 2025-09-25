import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logInfo, logError } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    logInfo('[MARK PAID] ===== MARK ORDER AS PAID API CALLED =====');
    logInfo('[MARK PAID] Request received at:', new Date().toISOString());
    
    const { orderId } = await req.json();
    logInfo('[MARK PAID] Order ID:', orderId);
    
    if (!orderId) {
      logInfo('[MARK PAID] ERROR: Order ID is required');
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
      logError('Failed to fetch order:', fetchError);
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
      logError('Failed to mark order as paid:', error);
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
          logInfo('[MARK PAID] Auto-completion check result:', completionResult);
        }
      } catch (completionError) {
        logError('[MARK PAID] Error checking reservation completion:', completionError);
        // Don't fail the main request if completion check fails
      }
    }

    logInfo('[MARK PAID] Successfully marked order as paid:', orderId);
    logInfo('[MARK PAID] ===== MARK ORDER AS PAID COMPLETED SUCCESSFULLY =====');
    
    return NextResponse.json({ 
      success: true,
      orderId,
      payment_status: 'PAID',
      updated_at: new Date().toISOString()
    });
  } catch (error: any) {
    logError('[MARK PAID] Error marking order as paid:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


