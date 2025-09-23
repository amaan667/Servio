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

    // Handle table cleanup - completely remove ALL tables that were associated with completed orders
    if (updatedOrders && updatedOrders.length > 0) {
      // Get all unique table IDs from completed orders (regardless of source)
      const tableIds = [...new Set(updatedOrders
        .filter(order => order.table_id)
        .map(order => order.table_id)
      )];
      
      console.log('[BULK COMPLETE] Tables to be completely removed:', tableIds);
      
      for (const tableId of tableIds) {
        try {
          console.log('[BULK COMPLETE] Completely removing table:', tableId);
          
          // Delete the table completely (not just set to free)
          const { error: deleteTableError } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('venue_id', venueId);

          if (deleteTableError) {
            console.error('[BULK COMPLETE] Error deleting table:', deleteTableError);
          } else {
            console.log('[BULK COMPLETE] Successfully deleted table:', tableId);
          }
          
          // Also clean up any table sessions
          const { error: deleteSessionError } = await supabase
            .from('table_sessions')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteSessionError) {
            console.error('[BULK COMPLETE] Error deleting table sessions:', deleteSessionError);
          } else {
            console.log('[BULK COMPLETE] Successfully deleted table sessions for table:', tableId);
          }
          
          // Clean up table runtime state
          const { error: deleteRuntimeError } = await supabase
            .from('table_runtime_state')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteRuntimeError) {
            console.error('[BULK COMPLETE] Error deleting table runtime state:', deleteRuntimeError);
          } else {
            console.log('[BULK COMPLETE] Successfully deleted table runtime state for table:', tableId);
          }
          
          // Clean up group sessions for this table
          const { error: deleteGroupSessionError } = await supabase
            .from('table_group_sessions')
            .delete()
            .eq('table_number', updatedOrders.find(o => o.table_id === tableId)?.table_number)
            .eq('venue_id', venueId);

          if (deleteGroupSessionError) {
            console.error('[BULK COMPLETE] Error deleting group sessions:', deleteGroupSessionError);
          } else {
            console.log('[BULK COMPLETE] Successfully deleted group sessions for table:', tableId);
          }
          
        } catch (tableError) {
          console.error('[BULK COMPLETE] Error handling table cleanup for table:', tableId, tableError);
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
