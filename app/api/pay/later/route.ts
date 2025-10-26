import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id, sessionId } = body;

    logger.info('⏰ [PAY LATER] Pay later requested', {
      orderId: order_id,
      sessionId,
      timestamp: new Date().toISOString()
    });

    if (!order_id) {
      logger.error('❌ [PAY LATER] Missing order ID');
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
          set(name: string, value: string, options: unknown) { /* Empty */ },
          remove(name: string, options: unknown) { /* Empty */ },
        },
      }
    );

    // Update order to PAY_LATER status (so it can be found on re-scan)
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAY_LATER',
        payment_method: 'later',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError || !order) {
      logger.error('❌ [PAY LATER] Failed to update order', {
        orderId: order_id,
        error: updateError?.message
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to process order' 
      }, { status: 500 });
    }

    logger.info('✅ [PAY LATER] Order marked as pay later successfully', {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
      note: 'Customer can re-scan QR to pay online'
    });

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      data: {
        order_id: order.id,
        payment_status: 'PAY_LATER',
        payment_method: 'later',
        total_amount: order.total_amount
      }
    });

  } catch (_error) {
    logger.error('[PAY LATER] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
