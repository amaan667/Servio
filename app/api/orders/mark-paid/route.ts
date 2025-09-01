import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'PAID' })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to mark order as paid:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Mark paid error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


