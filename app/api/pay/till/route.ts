import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(_req: Request) {
  try {
    const body = await req.json();
    const { order_id } = body;

    logger.info('💳 [PAY TILL] Payment at till requested', {
      orderId: order_id,
      timestamp: new Date().toISOString()
    });

    if (!order_id) {
      logger.error('❌ [PAY TILL] Missing order ID');
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID is required' 
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: unknown) { },
          remove(name: string, options: unknown) { },
        },
      }
    );

    // Update order payment status to till
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'TILL',
        payment_method: 'till',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError || !order) {
      logger.error('❌ [PAY TILL] Failed to update order', {
        orderId: order_id,
        error: updateError?.message
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to process order' 
      }, { status: 500 });
    }

    logger.info('✅ [PAY TILL] Order marked for till payment successfully', {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number
    });

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      data: {
        order_id: order.id,
        payment_status: 'TILL',
        payment_method: 'till',
        total_amount: order.total_amount
      }
    });

  } catch (_error) {
    logger.error('[PAY TILL] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
