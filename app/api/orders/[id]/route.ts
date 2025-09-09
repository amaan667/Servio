import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('[ORDER GET] Fetching order:', id);

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
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[ORDER GET] Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }

    if (!order) {
      console.log('[ORDER GET] Order not found:', id);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('[ORDER GET] Order found:', {
      id: order.id,
      status: order.order_status,
      payment_status: order.payment_status,
      total_amount: order.total_amount
    });

    return NextResponse.json(order);

  } catch (error: any) {
    console.error('[ORDER GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
