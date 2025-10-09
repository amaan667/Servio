import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    console.log('[ORDER SESSION LOOKUP DEBUG] ===== LOOKING UP ORDER BY SESSION =====');
    console.log('[ORDER SESSION LOOKUP DEBUG] Session ID:', sessionId);
    
    if (!sessionId) {
      console.error('[ORDER SESSION LOOKUP DEBUG] No session ID provided');
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Look up order by stripe_session_id with all fields including Stripe details
    console.log('[ORDER SESSION LOOKUP DEBUG] Querying orders table for stripe_session_id...');
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

    console.log('[ORDER SESSION LOOKUP DEBUG] Query result:');
    console.log('[ORDER SESSION LOOKUP DEBUG] - Found order:', !!order);
    console.log('[ORDER SESSION LOOKUP DEBUG] - Error:', orderError);
    console.log('[ORDER SESSION LOOKUP DEBUG] - Order data:', order);

    if (orderError) {
      console.error('[ORDER SESSION LOOKUP DEBUG] Database error:', orderError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Order not found for this session' 
      }, { status: 404 });
    }

    if (!order) {
      console.error('[ORDER SESSION LOOKUP DEBUG] No order found for session:', sessionId);
      return NextResponse.json({ 
        ok: false, 
        error: 'Order not found for this session' 
      }, { status: 404 });
    }

    console.log('[ORDER SESSION LOOKUP DEBUG] ===== ORDER FOUND =====');
    console.log('[ORDER SESSION LOOKUP DEBUG] Order details:', {
      id: order.id,
      customer_name: order.customer_name,
      table_number: order.table_number,
      venue_id: order.venue_id,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      order_status: order.order_status,
      stripe_session_id: order.stripe_session_id,
      stripe_payment_intent_id: order.stripe_payment_intent_id,
      items_count: order.order_items?.length || 0
    });

    // Transform the order to include items array
    const transformedOrder = {
      ...order,
      items: order.order_items || []
    };

    // Remove the order_items property since we have items now
    delete transformedOrder.order_items;

    console.log('[ORDER SESSION LOOKUP DEBUG] ===== RETURNING TRANSFORMED ORDER =====');
    console.log('[ORDER SESSION LOOKUP DEBUG] Transformed order keys:', Object.keys(transformedOrder));

    return NextResponse.json({ 
      ok: true, 
      orderId: order.id,
      order: transformedOrder
    });

  } catch (error) {
    console.error('[ORDER SESSION LOOKUP DEBUG] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
