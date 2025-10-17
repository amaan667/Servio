import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabaseAdmin = createAdminClient();
    const { orderId } = await params;
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('[ORDER FETCH DEBUG] ===== FETCHING ORDER BY ID =====');
    console.log('[ORDER FETCH DEBUG] Order ID:', orderId);

    // Fetch order with items (items are stored as JSONB in orders table)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    console.log('[ORDER FETCH DEBUG] Query result:');
    console.log('[ORDER FETCH DEBUG] - Found order:', !!order);
    console.log('[ORDER FETCH DEBUG] - Error:', orderError);
    console.log('[ORDER FETCH DEBUG] - Order data keys:', order ? Object.keys(order) : 'N/A');

    if (orderError) {
      console.error('[ORDER FETCH DEBUG] ===== ORDER NOT FOUND =====');
      console.error('[ORDER FETCH DEBUG] Error fetching order:', orderError);
      return NextResponse.json({ 
        error: 'Order not found' 
      }, { status: 404 });
    }

    if (!order) {
      console.error('[ORDER FETCH DEBUG] ===== NO ORDER DATA =====');
      return NextResponse.json({ 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Log payment details
    console.log('[ORDER FETCH DEBUG] ===== ORDER FOUND - PAYMENT DETAILS =====');
    console.log('[ORDER FETCH DEBUG] Payment method:', order.payment_method);
    console.log('[ORDER FETCH DEBUG] Payment status:', order.payment_status);
    console.log('[ORDER FETCH DEBUG] Stripe session ID:', order.stripe_session_id);
    console.log('[ORDER FETCH DEBUG] Stripe payment intent ID:', order.stripe_payment_intent_id);
    console.log('[ORDER FETCH DEBUG] Order notes:', order.notes);

    // Items are already in the order object as JSONB
    // Ensure items array exists (fallback to empty array if null)
    const transformedOrder = {
      ...order,
      items: order.items || []
    };

    console.log('[ORDER FETCH DEBUG] ===== RETURNING TRANSFORMED ORDER =====');
    console.log('[ORDER FETCH DEBUG] Transformed order keys:', Object.keys(transformedOrder));
    console.log('[ORDER FETCH DEBUG] Items count:', Array.isArray(transformedOrder.items) ? transformedOrder.items.length : 0);

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