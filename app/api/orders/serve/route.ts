import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
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

    // Only allow serving orders that are READY
    if (orderData.order_status !== 'READY') {
      return NextResponse.json({ 
        error: 'Order must be READY to mark as SERVED' 
      }, { status: 400 });
    }

    // Update the order status to SERVED
    const { error } = await supabase
      .from('orders')
      .update({ 
        order_status: 'SERVED',
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to update order status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order marked as served' 
    });

  } catch (error: any) {
    console.error('Error in serve endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
