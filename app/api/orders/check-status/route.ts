import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('[ORDER STATUS CHECK] Checking status for order:', orderId);

    // Create admin client to bypass RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return undefined; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_status, payment_status, payment_method, created_at')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      console.error('[ORDER STATUS CHECK] Database error:', error);
      return NextResponse.json({ error: 'Failed to check order status' }, { status: 500 });
    }

    if (!order) {
      console.log('[ORDER STATUS CHECK] Order not found:', orderId);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('[ORDER STATUS CHECK] Order found:', {
      id: order.id,
      order_status: order.order_status,
      payment_status: order.payment_status,
      payment_method: order.payment_method
    });

    return NextResponse.json({
      id: order.id,
      order_status: order.order_status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      created_at: order.created_at
    });

  } catch (error: any) {
    console.error('[ORDER STATUS CHECK] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
