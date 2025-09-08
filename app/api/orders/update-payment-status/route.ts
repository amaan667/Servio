import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentStatus, paymentMethod } = await req.json();
    
    if (!orderId || !paymentStatus) {
      return NextResponse.json(
        { error: 'Order ID and payment status are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Convert to uppercase for database consistency
    const updateData: any = {
      payment_status: paymentStatus.toUpperCase(),
      updated_at: new Date().toISOString()
    };
    
    if (paymentMethod) {
      updateData.payment_method = paymentMethod.toUpperCase();
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) {
      console.error('[UPDATE PAYMENT STATUS] Failed to update payment status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    console.log('[UPDATE PAYMENT STATUS] Payment status updated successfully:', data);
    return NextResponse.json({ success: true, data });
    
  } catch (error: any) {
    console.error('[UPDATE PAYMENT STATUS] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
