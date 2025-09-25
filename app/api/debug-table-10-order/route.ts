import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    
    const supabase = createAdminClient();
    
    // Get all orders for table 10 from the last 24 hours
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, table_number, source, customer_name, created_at, order_status, payment_status')
      .eq('table_number', 10)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching orders:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch orders' 
      }, { status: 500 });
    }


    // Check if any orders need fixing
    const ordersToFix = orders?.filter(order => 
      order.payment_status !== 'PAID' || 
      order.source !== 'qr' ||
      order.order_status === 'COMPLETED'
    ) || [];


    // Fix orders that need it
    if (ordersToFix.length > 0) {
      for (const order of ordersToFix) {
        const updates: any = {};
        
        // Ensure payment status is PAID so it shows in the dashboard
        if (order.payment_status !== 'PAID') {
          updates.payment_status = 'PAID';
        }
        
        // Ensure source is qr for table orders
        if (order.source !== 'qr') {
          updates.source = 'qr';
        }
        
        // If order is completed, it should show in Earlier Today tab
        if (order.order_status === 'COMPLETED') {
          // Keep it as completed but ensure it's paid
          if (!updates.payment_status) {
            updates.payment_status = 'PAID';
          }
        }

        if (Object.keys(updates).length > 0) {
          
          const { error: updateError } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', order.id);

          if (updateError) {
            console.error(`❌ Error updating order ${order.id}:`, updateError);
          } else {
          }
        }
      }
    }

    // Get updated orders
    const { data: updatedOrders, error: updatedFetchError } = await supabase
      .from('orders')
      .select('id, table_number, source, customer_name, created_at, order_status, payment_status')
      .eq('table_number', 10)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const results = updatedOrders?.map(order => ({
      id: order.id,
      customer_name: order.customer_name,
      table_number: order.table_number,
      source: order.source,
      order_status: order.order_status,
      payment_status: order.payment_status,
      display_name: order.source === 'qr' ? `Table ${order.table_number}` : 
                   order.source === 'counter' ? `Counter ${order.table_number}` : 'Unknown',
      created_at: order.created_at,
      age_minutes: Math.round((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60))
    })) || [];
    
    return NextResponse.json({
      success: true,
      message: 'Table 10 order debug and fix completed',
      originalOrders: orders?.length || 0,
      ordersFixed: ordersToFix.length,
      results
    });
    
  } catch (error) {
    console.error('❌ Debug table 10 order failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
