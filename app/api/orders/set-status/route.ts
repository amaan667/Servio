import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cleanupTableOnOrderCompletion } from '@/lib/table-cleanup';

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();
    
    if (!orderId || !status) {
      return NextResponse.json({ error: 'Order ID and status are required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // First get the order details before updating
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch order:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Update the order status
    const { error } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to set order status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle table clearing when order is completed or cancelled
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const order = orderData;
      if (order && (order.table_id || order.table_number)) {
        
        // Use centralized table cleanup function
        const cleanupResult = await cleanupTableOnOrderCompletion({
          venueId: order.venue_id,
          tableId: order.table_id,
          tableNumber: order.table_number,
          orderId: orderId
        });

        if (!cleanupResult.success) {
          console.error('[SET STATUS] Table cleanup failed:', cleanupResult.error);
        } else {
          console.log('[SET STATUS] Table cleanup successful:', cleanupResult.details);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Set status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
