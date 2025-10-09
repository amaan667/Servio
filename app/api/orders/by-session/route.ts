import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Fetch order by Stripe session ID
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
      .eq('stripe_session_id', sessionId)
      .single();

    if (orderError) {
      console.error('[ORDER BY SESSION] Error fetching order:', orderError);
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
    console.error('[ORDER BY SESSION] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
