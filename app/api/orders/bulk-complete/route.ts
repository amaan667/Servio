import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { logInfo, logWarn, logError } from "@/lib/logger";

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    logInfo('[BULK COMPLETE] ===== BULK COMPLETE ORDERS API CALLED =====');
    
    const { venueId, orderIds } = await req.json();
    logInfo('[BULK COMPLETE] Venue ID:', venueId);
    logInfo('[BULK COMPLETE] Order IDs:', orderIds);
    
    if (!venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    
    const supabase = await createClient();
    
    // If no specific order IDs provided, get all active orders for the venue
    let targetOrderIds = orderIds;
    if (!targetOrderIds || targetOrderIds.length === 0) {
      logInfo('[BULK COMPLETE] No specific order IDs provided, fetching all active orders');
      const { data: activeOrders, error: fetchError } = await supabase
        .from('orders')
        .select('id')
        .eq('venue_id', venueId)
        .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING']);
      
      if (fetchError) {
        logError('[BULK COMPLETE] Error fetching active orders:', fetchError);
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
    
    logInfo('[BULK COMPLETE] Completing orders:', targetOrderIds);
    
    // Get order details before updating to handle table cleanup
    const { data: ordersToComplete, error: fetchOrdersError } = await supabase
      .from('orders')
      .select('id, table_id, table_number, source, venue_id')
      .in('id', targetOrderIds)
      .eq('venue_id', venueId);
    
    if (fetchOrdersError) {
      logError('[BULK COMPLETE] Error fetching order details:', fetchOrdersError);
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
      logError('[BULK COMPLETE] Error updating orders:', updateError);
      return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
    }

    logInfo('[BULK COMPLETE] Successfully updated orders:', updatedOrders?.length || 0);

    // Handle table cleanup - completely remove ALL tables that were associated with completed orders
    if (updatedOrders && updatedOrders.length > 0) {
      // Get all unique table IDs from completed orders (regardless of source)
      const tableIds = [...new Set(updatedOrders
        .filter(order => order.table_id)
        .map(order => order.table_id)
      )];
      
      logInfo('[BULK COMPLETE] Tables to be completely removed:', tableIds);
      
      for (const tableId of tableIds) {
        try {
          logInfo('[BULK COMPLETE] Completely removing table:', tableId);
          
          // Get table details first
          const { data: tableDetails, error: tableDetailsError } = await supabase
            .from('tables')
            .select('id, label, venue_id')
            .eq('id', tableId)
            .eq('venue_id', venueId)
            .single();

          if (tableDetailsError) {
            logError('[BULK COMPLETE] Error fetching table details:', tableDetailsError);
            continue; // Skip this table if we can't get details
          }

          // Clear table_id references in orders to avoid foreign key constraint issues
          logInfo('[BULK COMPLETE] Clearing table_id references in orders...');
          const { error: clearTableRefsError } = await supabase
            .from('orders')
            .update({ table_id: null })
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (clearTableRefsError) {
            logError('[BULK COMPLETE] Error clearing table references in orders:', clearTableRefsError);
            logWarn('[BULK COMPLETE] Proceeding with table deletion despite table reference clear failure');
          } else {
            logInfo('[BULK COMPLETE] Successfully cleared table references in orders');
          }

          // Delete table sessions first
          logInfo('[BULK COMPLETE] Deleting table sessions...');
          const { error: deleteSessionError } = await supabase
            .from('table_sessions')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteSessionError) {
            logError('[BULK COMPLETE] Error deleting table sessions:', deleteSessionError);
            logWarn('[BULK COMPLETE] Proceeding with table deletion despite session deletion failure');
          } else {
            logInfo('[BULK COMPLETE] Successfully deleted table sessions for table:', tableId);
          }
          
          // Clean up table runtime state
          logInfo('[BULK COMPLETE] Deleting table runtime state...');
          const { error: deleteRuntimeError } = await supabase
            .from('table_runtime_state')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteRuntimeError) {
            logError('[BULK COMPLETE] Error deleting table runtime state:', deleteRuntimeError);
            logWarn('[BULK COMPLETE] Proceeding with table deletion despite runtime state deletion failure');
          } else {
            logInfo('[BULK COMPLETE] Successfully deleted table runtime state for table:', tableId);
          }
          
          // Clean up group sessions for this table
          logInfo('[BULK COMPLETE] Deleting group sessions...');
          const { error: deleteGroupSessionError } = await supabase
            .from('table_group_sessions')
            .delete()
            .eq('table_number', tableDetails.label) // Use table label to match group sessions
            .eq('venue_id', venueId);

          if (deleteGroupSessionError) {
            logError('[BULK COMPLETE] Error deleting group sessions:', deleteGroupSessionError);
            logWarn('[BULK COMPLETE] Proceeding with table deletion despite group session deletion failure');
          } else {
            logInfo('[BULK COMPLETE] Successfully deleted group sessions for table:', tableId);
          }

          // Finally, delete the table itself
          logInfo('[BULK COMPLETE] Deleting table...');
          const { error: deleteTableError } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('venue_id', venueId);

          if (deleteTableError) {
            logError('[BULK COMPLETE] Error deleting table:', deleteTableError);
            logError('[BULK COMPLETE] Error details:', {
              message: deleteTableError.message,
              details: deleteTableError.details,
              hint: deleteTableError.hint,
              code: deleteTableError.code
            });
          } else {
            logInfo('[BULK COMPLETE] Successfully deleted table:', tableId);
          }
          
        } catch (tableError) {
          logError('[BULK COMPLETE] Error handling table cleanup for table:', tableId, tableError);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      completedCount: updatedOrders?.length || 0,
      message: `Successfully completed ${updatedOrders?.length || 0} orders and cleaned up tables`
    });

  } catch (error) {
    logError('[BULK COMPLETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
