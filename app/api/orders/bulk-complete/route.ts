import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { cleanupTableOnOrderCompletion } from '@/lib/table-cleanup';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    
    const { venueId, orderIds } = await req.json();
    
    if (!venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    
    const supabase = await createClient();
    
    // If no specific order IDs provided, get all active orders for the venue
    let targetOrderIds = orderIds;
    if (!targetOrderIds || targetOrderIds.length === 0) {
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


    // Handle table cleanup for completed orders
    if (updatedOrders && updatedOrders.length > 0) {
      // Get all unique table identifiers from completed orders
      const tableCleanupTasks = [];
      
      for (const order of updatedOrders) {
        if (order.table_id || order.table_number) {
          tableCleanupTasks.push(
            cleanupTableOnOrderCompletion({
              venueId: order.venue_id,
              tableId: order.table_id,
              tableNumber: order.table_number
            })
          );
        }
      }
      
      // Execute all cleanup tasks in parallel
      const cleanupResults = await Promise.allSettled(tableCleanupTasks);
      
      // Log results
      cleanupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            console.log(`[BULK COMPLETE] Table cleanup ${index + 1} successful:`, result.value.details);
          } else {
            console.error(`[BULK COMPLETE] Table cleanup ${index + 1} failed:`, result.value.error);
          }
        } else {
          console.error(`[BULK COMPLETE] Table cleanup ${index + 1} rejected:`, result.reason);
        }
      });
      
      // Legacy table deletion logic (commented out - use cleanup instead)
      /*
      const tableIds = [...new Set(updatedOrders
        .filter(order => order.table_id)
        .map(order => order.table_id)
      )];
      
      for (const tableId of tableIds) {
        try {
          
          // Get table details first
          const { data: tableDetails, error: tableDetailsError } = await supabase
            .from('tables')
            .select('id, label, venue_id')
            .eq('id', tableId)
            .eq('venue_id', venueId)
            .single();

          if (tableDetailsError) {
            console.error('[BULK COMPLETE] Error fetching table details:', tableDetailsError);
            continue; // Skip this table if we can't get details
          }

          // Clear table_id references in orders to avoid foreign key constraint issues
          const { error: clearTableRefsError } = await supabase
            .from('orders')
            .update({ table_id: null })
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (clearTableRefsError) {
            console.error('[BULK COMPLETE] Error clearing table references in orders:', clearTableRefsError);
            console.warn('[BULK COMPLETE] Proceeding with table deletion despite table reference clear failure');
          } else {
          }

          // Delete table sessions first
          const { error: deleteSessionError } = await supabase
            .from('table_sessions')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteSessionError) {
            console.error('[BULK COMPLETE] Error deleting table sessions:', deleteSessionError);
            console.warn('[BULK COMPLETE] Proceeding with table deletion despite session deletion failure');
          } else {
          }
          
          // Clean up table runtime state
          const { error: deleteRuntimeError } = await supabase
            .from('table_runtime_state')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteRuntimeError) {
            console.error('[BULK COMPLETE] Error deleting table runtime state:', deleteRuntimeError);
            console.warn('[BULK COMPLETE] Proceeding with table deletion despite runtime state deletion failure');
          } else {
          }
          
          // Clean up group sessions for this table
          const { error: deleteGroupSessionError } = await supabase
            .from('table_group_sessions')
            .delete()
            .eq('table_number', tableDetails.label) // Use table label to match group sessions
            .eq('venue_id', venueId);

          if (deleteGroupSessionError) {
            console.error('[BULK COMPLETE] Error deleting group sessions:', deleteGroupSessionError);
            console.warn('[BULK COMPLETE] Proceeding with table deletion despite group session deletion failure');
          } else {
          }

          // Finally, delete the table itself
          const { error: deleteTableError } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('venue_id', venueId);

          if (deleteTableError) {
            console.error('[BULK COMPLETE] Error deleting table:', deleteTableError);
            console.error('[BULK COMPLETE] Error details:', {
              message: deleteTableError.message,
              details: deleteTableError.details,
              hint: deleteTableError.hint,
              code: deleteTableError.code
            });
          } else {
          }
          
        } catch (tableError) {
          console.error('[BULK COMPLETE] Error handling table cleanup for table:', tableId, tableError);
        }
      }
      */
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
