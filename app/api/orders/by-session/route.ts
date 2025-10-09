import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    console.log('[ORDER BY SESSION] Request URL:', req.url);
    console.log('[ORDER BY SESSION] Session ID from params:', sessionId);
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // First try to fetch order by Stripe session ID
    console.log('[ORDER BY SESSION] Searching for order with stripe_session_id:', sessionId);
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

    // If not found by session ID, try to find recent orders that might be related
    if (orderError && orderError.code === 'PGRST116') {
      console.log('[ORDER BY SESSION] No order found with session ID, checking recent orders...');
      
      // Look for orders created in the last 15 minutes that are paid
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentPaidOrders, error: recentError } = await supabaseAdmin
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
        .eq('payment_status', 'PAID')
        .eq('payment_method', 'stripe')
        .gte('created_at', fifteenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentPaidOrders && recentPaidOrders.length > 0) {
        console.log('[ORDER BY SESSION] Found recent paid order:', recentPaidOrders[0].id);
        const recentOrder = recentPaidOrders[0];
        
        // Transform the order to include items array
        const transformedOrder = {
          ...recentOrder,
          items: recentOrder.order_items || []
        };
        delete transformedOrder.order_items;

        return NextResponse.json({ 
          order: transformedOrder,
          fallback: true,
          message: 'Found recent paid order (session ID not yet set)'
        });
      }
    }

    if (orderError) {
      console.error('[ORDER BY SESSION] Error fetching order by stripe_session_id:', orderError);
      return NextResponse.json({ 
        error: 'Order not found for this session ID' 
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
