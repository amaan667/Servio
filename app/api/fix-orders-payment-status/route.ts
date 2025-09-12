import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [FIX ORDERS] Starting to fix all orders payment status...');
    
    const { venueId } = await request.json();
    
    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    console.log('🔧 [FIX ORDERS] Admin client created');

    // First, let's see what orders we have and their current status
    console.log('🔧 [FIX ORDERS] Checking current order statuses...');
    const { data: currentOrders, error: currentError } = await supabase
      .from('orders')
      .select('order_status, payment_status')
      .eq('venue_id', venueId);
    
    if (currentError) {
      console.error('🔧 [FIX ORDERS] Error fetching current orders:', currentError);
      return NextResponse.json(
        { error: `Failed to fetch current orders: ${currentError.message}` },
        { status: 500 }
      );
    }
    
    // Group by status
    const statusCounts = currentOrders.reduce((acc: Record<string, number>, order) => {
      const key = `${order.order_status}-${order.payment_status}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('🔧 [FIX ORDERS] Current order statuses:', statusCounts);
    
    // Update all orders to be COMPLETED and PAID
    console.log('🔧 [FIX ORDERS] Updating all orders to COMPLETED and PAID...');
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({
        order_status: 'COMPLETED',
        payment_status: 'PAID',
        updated_at: new Date().toISOString()
      })
      .eq('venue_id', venueId)
      .select('id, order_status, payment_status');
    
    if (updateError) {
      console.error('🔧 [FIX ORDERS] Error updating orders:', updateError);
      return NextResponse.json(
        { error: `Failed to update orders: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    console.log('🔧 [FIX ORDERS] Successfully updated orders:', updatedOrders.length);
    
    // Verify the update
    console.log('🔧 [FIX ORDERS] Verifying update...');
    const { data: verifyOrders, error: verifyError } = await supabase
      .from('orders')
      .select('order_status, payment_status')
      .eq('venue_id', venueId);
    
    if (verifyError) {
      console.error('🔧 [FIX ORDERS] Error verifying orders:', verifyError);
      return NextResponse.json(
        { error: `Failed to verify orders: ${verifyError.message}` },
        { status: 500 }
      );
    }
    
    // Group by status after update
    const newStatusCounts = verifyOrders.reduce((acc: Record<string, number>, order) => {
      const key = `${order.order_status}-${order.payment_status}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('🔧 [FIX ORDERS] Order statuses after update:', newStatusCounts);
    console.log('🔧 [FIX ORDERS] ✅ All orders have been updated to COMPLETED and PAID!');
    
    return NextResponse.json({
      success: true,
      message: 'All orders have been updated to COMPLETED and PAID',
      results: {
        totalOrders: verifyOrders.length,
        updatedOrders: updatedOrders.length,
        beforeStatuses: statusCounts,
        afterStatuses: newStatusCounts
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔧 [FIX ORDERS] Unexpected error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
