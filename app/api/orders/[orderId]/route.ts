import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('[ORDER FETCH] Fetching order:', orderId);

    // Fetch order with items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          menu_item_id,
          item_name,
          quantity,
          price,
          special_instructions
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('[ORDER FETCH] Error fetching order:', orderError);
      return NextResponse.json({ 
        error: 'Order not found' 
      }, { status: 404 });
    }

    if (!order) {
      return NextResponse.json({ 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Transform the order to include items array
    const transformedOrder = {
      ...order,
      items: order.order_items || []
    };

    // Remove the order_items property since we have items now
    delete transformedOrder.order_items;

    console.log('[ORDER FETCH] Order fetched successfully:', orderId);

    return NextResponse.json({ 
      order: transformedOrder 
    });

  } catch (error) {
    console.error('[ORDER FETCH] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}