import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database connection' },
        { status: 500 }
      );
    }

    const { orderId } = params;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Fetch the order with venue information
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        venues!inner(name)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Transform the order data to match the expected format
    const transformedOrder = {
      id: order.id,
      venue_id: order.venue_id,
      venue_name: order.venues?.name,
      table_number: order.table_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      order_status: order.order_status,
      payment_status: order.payment_status,
      total_amount: order.total_amount,
      items: Array.isArray(order.items) ? order.items.map((item: any) => ({
        item_name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        specialInstructions: item.special_instructions
      })) : [],
      created_at: order.created_at,
      notes: order.special_instructions
    };

    return NextResponse.json(transformedOrder);

  } catch (error) {
    console.error('Unexpected error fetching order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
