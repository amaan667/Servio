import { errorToContext } from '@/lib/utils/error-to-context';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id, payment_intent_id } = body;

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

    // In a real implementation, you would:
    // 1. Verify the payment intent with Stripe
    // 2. Confirm the payment was successful
    // 3. Handle unknown failed payments
    
    // For now, we'll simulate a successful payment
    const paymentSuccess = true; // In production, verify with Stripe API

    if (!paymentSuccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Payment failed' 
      }, { status: 400 });
    }

    // Update order payment status to paid with stripe method
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        payment_method: 'stripe',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError || !order) {
      logger.error('[PAY STRIPE] Failed to update order:', { value: updateError });
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to process payment' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        payment_status: 'PAID',
        payment_method: 'stripe',
        total_amount: order.total_amount,
        payment_intent_id: payment_intent_id
      }
    });

  } catch (error) {
    logger.error('[PAY STRIPE] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
