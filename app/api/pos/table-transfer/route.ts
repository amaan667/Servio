import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      venue_id, 
      action,
      source_table_id,
      target_table_id,
      order_ids,
      merge_sessions = false
    } = body;

    if (!venue_id || !action || !source_table_id || !target_table_id) {
      return NextResponse.json({ error: 'venue_id, action, source_table_id, and target_table_id are required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'transfer_orders':
        // Transfer specific orders from source to target table
        if (!order_ids || !Array.isArray(order_ids)) {
          return NextResponse.json({ error: 'order_ids array is required for transfer' }, { status: 400 });
        }

        const { error: transferError } = await supabase
          .from('orders')
          .update({ table_id: target_table_id })
          .in('id', order_ids)
          .eq('venue_id', venue_id)
          .eq('table_id', source_table_id);

        if (transferError) {
          logger.error('[POS TABLE TRANSFER] Error transferring orders:', transferError);
          return NextResponse.json({ error: 'Failed to transfer orders' }, { status: 500 });
        }

        result = { 
          action: 'transferred', 
          transferred_orders: order_ids.length,
          from_table: source_table_id,
          to_table: target_table_id
        };
        break;

      case 'merge_tables':
        // Merge all orders from source table to target table
        const { data: sourceOrders, error: sourceError } = await supabase
          .from('orders')
          .select('id')
          .eq('venue_id', venue_id)
          .eq('table_id', source_table_id)
          .eq('is_active', true);

        if (sourceError) {
          logger.error('[POS TABLE TRANSFER] Error fetching source orders:', sourceError);
          return NextResponse.json({ error: 'Failed to fetch source orders' }, { status: 500 });
        }

        if (sourceOrders && sourceOrders.length > 0) {
          const orderIds = sourceOrders.map(order => order.id);
          
          const { error: mergeError } = await supabase
            .from('orders')
            .update({ table_id: target_table_id })
            .in('id', orderIds)
            .eq('venue_id', venue_id);

          if (mergeError) {
            logger.error('[POS TABLE TRANSFER] Error merging orders:', mergeError);
            return NextResponse.json({ error: 'Failed to merge orders' }, { status: 500 });
          }
        }

        // Merge table sessions if requested
        if (merge_sessions) {
          const { error: sessionError } = await supabase
            .from('table_sessions')
            .update({ 
              closed_at: new Date().toISOString(),
              status: 'CLOSED'
            })
            .eq('venue_id', venue_id)
            .eq('table_id', source_table_id)
            .eq('closed_at', null);

          if (sessionError) {
            logger.error('[POS TABLE TRANSFER] Error closing source session:', sessionError);
          }
        }

        result = { 
          action: 'merged', 
          merged_orders: sourceOrders?.length || 0,
          from_table: source_table_id,
          to_table: target_table_id
        };
        break;

      case 'split_table':
        // Split orders between two tables
        if (!order_ids || !Array.isArray(order_ids)) {
          return NextResponse.json({ error: 'order_ids array is required for split' }, { status: 400 });
        }

        // Move specified orders to target table
        const { error: splitError } = await supabase
          .from('orders')
          .update({ table_id: target_table_id })
          .in('id', order_ids)
          .eq('venue_id', venue_id)
          .eq('table_id', source_table_id);

        if (splitError) {
          logger.error('[POS TABLE TRANSFER] Error splitting orders:', splitError);
          return NextResponse.json({ error: 'Failed to split orders' }, { status: 500 });
        }

        result = { 
          action: 'split', 
          split_orders: order_ids.length,
          remaining_at_source: source_table_id,
          moved_to_target: target_table_id
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[POS TABLE TRANSFER] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
