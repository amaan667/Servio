import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🔍 [API] Remove table endpoint called');
    
    const { tableId, venueId } = await request.json();
    console.log('🔍 [API] Request data:', { tableId, venueId });

    if (!tableId || !venueId) {
      console.log('🔍 [API] Missing required fields');
      return NextResponse.json(
        { error: 'Table ID and Venue ID are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    console.log('🔍 [API] Supabase client created');

    // Check if the table exists and belongs to the venue
    console.log('🔍 [API] Checking if table exists...');
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, label, venue_id')
      .eq('id', tableId)
      .eq('venue_id', venueId)
      .single();

    console.log('🔍 [API] Table query result:', { table, tableError });

    if (tableError || !table) {
      console.log('🔍 [API] Table not found or error:', tableError);
      return NextResponse.json(
        { error: 'Table not found or does not belong to this venue' },
        { status: 404 }
      );
    }

    // Check if the table has any active orders or reservations
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('table_id', tableId)
      .eq('venue_id', venueId)
      .in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED']);

    if (ordersError) {
      console.error('Error checking active orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to check for active orders' },
        { status: 500 }
      );
    }

    const { data: activeReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('table_id', tableId)
      .eq('venue_id', venueId)
      .eq('status', 'BOOKED');

    if (reservationsError) {
      console.error('Error checking active reservations:', reservationsError);
      return NextResponse.json(
        { error: 'Failed to check for active reservations' },
        { status: 500 }
      );
    }

    // If there are active orders or reservations, prevent deletion
    if (activeOrders && activeOrders.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active orders. Please close all orders first.',
          hasActiveOrders: true
        },
        { status: 400 }
      );
    }

    if (activeReservations && activeReservations.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active reservations. Please cancel all reservations first.',
          hasActiveReservations: true
        },
        { status: 400 }
      );
    }

    // Delete the table
    console.log('🔍 [API] Attempting to delete table...');
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId)
      .eq('venue_id', venueId);

    console.log('🔍 [API] Delete operation result:', { deleteError });

    if (deleteError) {
      console.error('🔍 [API] Error deleting table:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove table' },
        { status: 500 }
      );
    }

    console.log(`🔍 [API] Table ${table.label} (${tableId}) removed from venue ${venueId}`);

    return NextResponse.json({
      success: true,
      message: `Table "${table.label}" has been removed successfully`,
      removedTable: {
        id: tableId,
        label: table.label
      }
    });

  } catch (error) {
    console.error('Error in remove table API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
