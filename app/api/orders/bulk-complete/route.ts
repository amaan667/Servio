import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('[BULK COMPLETE] ===== BULK COMPLETE ORDERS API CALLED =====');
    
    const { venueId, orderIds } = await req.json();
    console.log('[BULK COMPLETE] Venue ID:', venueId);
    console.log('[BULK COMPLETE] Order IDs:', orderIds);
    
    if (!venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    
    const supabase = await createClient();
    
    // If no specific order IDs provided, get all active orders for the venue
    let targetOrderIds = orderIds;
    if (!targetOrderIds || targetOrderIds.length === 0) {
      console.log('[BULK COMPLETE] No specific order IDs provided, fetching all active orders');
      const { data: activeOrders, error: fetchError } = await supabase
        .from('orders')
        .select('id')
        .eq('venue_id', venueId)
        .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING']);
      
      if (fetchError) {
        console.error('[BULK COMPLETE] Error fetching active orders:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch active orders' }, { status: 500 });
      }
      
      targetOrderIds = activeOrders?.map(order => order.id) || [];
    }
    
    if (targetOrderIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        completedCount: 0,
        message: 'No active orders to complete'
      });
    }
    
    console.log('[BULK COMPLETE] Completing orders:', targetOrderIds);
    
    // Get order details before updating to handle table cleanup
    const { data: ordersToComplete, error: fetchOrdersError } = await supabase
      .from('orders')
      .select('id, table_id, table_number, source, venue_id')
      .in('id', targetOrderIds)
      .eq('venue_id', venueId);
    
    if (fetchOrdersError) {
      console.error('[BULK COMPLETE] Error fetching order details:', fetchOrdersError);
      return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 });
    }
    
    // Update all orders to COMPLETED status
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({ 
        order_status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .in('id', targetOrderIds)
      .eq('venue_id', venueId)
      .select('id, table_id, table_number, source');

    if (updateError) {
      console.error('[BULK COMPLETE] Error updating orders:', updateError);
      return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
    }

    console.log('[BULK COMPLETE] Successfully updated orders:', updatedOrders?.length || 0);

    // Handle table cleanup - completely remove tables that were auto-created
    if (updatedOrders && updatedOrders.length > 0) {
      const tableOrders = updatedOrders.filter(order => order.source === 'qr' && order.table_id);
      
      for (const order of tableOrders) {
        try {
          console.log('[BULK COMPLETE] Cleaning up table for order:', order.id);
          
          // Check if this was the last active order for this table
          const { data: activeOrders, error: activeOrdersError } = await supabase
            .from('orders')
            .select('id')
            .eq('venue_id', venueId)
            .eq('table_id', order.table_id)
            .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING'])
            .neq('id', order.id);

          if (!activeOrdersError && (!activeOrders || activeOrders.length === 0)) {
            // No more active orders for this table, completely remove the table
            console.log('[BULK COMPLETE] Removing table completely:', order.table_id);
            
            // Delete the table completely (not just set to free)
            const { error: deleteTableError } = await supabase
              .from('tables')
              .delete()
              .eq('id', order.table_id)
              .eq('venue_id', venueId);

            if (deleteTableError) {
              console.error('[BULK COMPLETE] Error deleting table:', deleteTableError);
            } else {
              console.log('[BULK COMPLETE] Successfully deleted table:', order.table_id);
            }
            
            // Also clean up any table sessions
            const { error: deleteSessionError } = await supabase
              .from('table_sessions')
              .delete()
              .eq('table_id', order.table_id)
              .eq('venue_id', venueId);

            if (deleteSessionError) {
              console.error('[BULK COMPLETE] Error deleting table sessions:', deleteSessionError);
            }
            
            // Clean up table runtime state
            const { error: deleteRuntimeError } = await supabase
              .from('table_runtime_state')
              .delete()
              .eq('table_id', order.table_id)
              .eq('venue_id', venueId);

            if (deleteRuntimeError) {
              console.error('[BULK COMPLETE] Error deleting table runtime state:', deleteRuntimeError);
            }
          }
        } catch (tableError) {
          console.error('[BULK COMPLETE] Error handling table cleanup for order:', order.id, tableError);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      completedCount: updatedOrders?.length || 0,
      message: `Successfully completed ${updatedOrders?.length || 0} orders and cleaned up tables`
    });

  } catch (error) {
    console.error('[BULK COMPLETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
