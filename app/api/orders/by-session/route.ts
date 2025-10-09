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

    if (orderError) {
      console.error('[ORDER BY SESSION] Error fetching order by stripe_session_id:', orderError);
      
      // Fallback: Try to find recent orders that might not have stripe_session_id set yet
      console.log('[ORDER BY SESSION] Trying fallback search for recent orders...');
      
      // First, let's see what orders exist in the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: allRecentOrders, error: allRecentError } = await supabaseAdmin
        .from('orders')
        .select('id, customer_name, table_number, payment_status, payment_method, stripe_session_id, created_at')
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('[ORDER BY SESSION] All recent orders:', allRecentOrders);
      
      // Now try to find paid orders without session ID
      const { data: recentOrders, error: recentError } = await supabaseAdmin
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
        .is('stripe_session_id', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('[ORDER BY SESSION] Fallback search also failed:', recentError);
        return NextResponse.json({ 
          error: 'Order not found' 
        }, { status: 404 });
      }

      if (recentOrders && recentOrders.length > 0) {
        console.log('[ORDER BY SESSION] Found recent paid order without session ID:', recentOrders[0].id);
        const fallbackOrder = recentOrders[0];
        
        // Transform the order to include items array
        const transformedOrder = {
          ...fallbackOrder,
          items: fallbackOrder.order_items || []
        };
        delete transformedOrder.order_items;

        return NextResponse.json({ 
          order: transformedOrder,
          fallback: true
        });
      }

      // Last resort: Find ANY recent paid order (regardless of payment method)
      console.log('[ORDER BY SESSION] Trying last resort: any recent paid order...');
      const { data: anyPaidOrder, error: anyPaidError } = await supabaseAdmin
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
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (anyPaidOrder && anyPaidOrder.length > 0) {
        console.log('[ORDER BY SESSION] Found any recent paid order:', anyPaidOrder[0].id);
        const lastResortOrder = anyPaidOrder[0];
        
        // Transform the order to include items array
        const transformedOrder = {
          ...lastResortOrder,
          items: lastResortOrder.order_items || []
        };
        delete transformedOrder.order_items;

        return NextResponse.json({ 
          order: transformedOrder,
          fallback: true,
          lastResort: true
        });
      }

      return NextResponse.json({ 
        error: 'Order not found',
        debug: {
          sessionId,
          allRecentOrders,
          recentOrders,
          anyPaidOrder
        }
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
