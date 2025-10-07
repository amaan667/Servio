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

    // Handle demo orders (orderId starts with 'demo-')
    if (orderId.startsWith('demo-')) {
      const demoOrder = {
        id: orderId,
        venue_id: 'demo-cafe',
        table_number: 1,
        customer_name: 'Demo Customer',
        customer_phone: '',
        order_status: 'PLACED',
        total_amount: 0,
        payment_method: 'demo',
        payment_status: 'PAID',
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return NextResponse.json({ order: demoOrder });
    }

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