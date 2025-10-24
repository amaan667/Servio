import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
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

    // Update order to keep unpaid status but mark as pay later
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'UNPAID',
        payment_method: 'later',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError || !order) {
      logger.error('[PAY LATER] Failed to update order:', { value: updateError });
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to process order' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        payment_status: 'UNPAID',
        payment_method: 'later',
        total_amount: order.total_amount
      }
    });

  } catch (error) {
    logger.error('[PAY LATER] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
