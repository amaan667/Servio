import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    const body = await req.json();
    const { label, seat_count, is_active, qr_version } = body;

    const supabase = await createClient();

    // Update table
    const updateData: any = {
      label: label?.trim(),
      seat_count,
      is_active,
      updated_at: new Date().toISOString(),
    };

    if (qr_version !== undefined) {
      updateData.qr_version = qr_version;
    }

    const { data: table, error } = await supabase
      .from('tables')
      .update(updateData)
      .eq('id', tableId)
      .select()
      .single();

    if (error) {
      console.error('[TABLES API] Error updating table:', error);
      return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    console.log('[TABLES API] DELETE request for tableId:', tableId);

    const supabase = await createClient();

    // First check if table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('tables')
      .select('id, label, venue_id')
      .eq('id', tableId)
      .single();

    if (checkError) {
      console.error('[TABLES API] Error checking table existence:', checkError);
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    console.log('[TABLES API] Found table to delete:', existingTable);

    // Check if the table has any active orders
    console.log('[TABLES API] Checking for active orders...', { tableId, venueId: existingTable.venue_id });
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('table_id', tableId)
      .eq('venue_id', existingTable.venue_id)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);
    
    console.log('[TABLES API] Active orders check result:', { activeOrders, ordersError });

    if (ordersError) {
      console.error('[TABLES API] Error checking active orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to check for active orders' },
        { status: 500 }
      );
    }

    // Check if the table has any active reservations
    console.log('[TABLES API] Checking for active reservations...', { tableId, venueId: existingTable.venue_id });
    const { data: activeReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('table_id', tableId)
      .eq('venue_id', existingTable.venue_id)
      .eq('status', 'BOOKED');
    
    console.log('[TABLES API] Active reservations check result:', { activeReservations, reservationsError });

    if (reservationsError) {
      console.error('[TABLES API] Error checking active reservations:', reservationsError);
      return NextResponse.json(
        { error: 'Failed to check for active reservations' },
        { status: 500 }
      );
    }

    // If there are active orders or reservations, prevent deletion
    console.log('[TABLES API] Checking if table can be removed...', {
      activeOrdersCount: activeOrders?.length || 0,
      activeReservationsCount: activeReservations?.length || 0
    });

    if (activeOrders && activeOrders.length > 0) {
      console.log('[TABLES API] Table has active orders, preventing removal');
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active orders. Please close all orders first.',
          hasActiveOrders: true
        },
        { status: 400 }
      );
    }

    if (activeReservations && activeReservations.length > 0) {
      console.log('[TABLES API] Table has active reservations, preventing removal');
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active reservations. Please cancel all reservations first.',
          hasActiveReservations: true
        },
        { status: 400 }
      );
    }

    // Delete table (this will cascade to table_sessions)
    console.log('[TABLES API] Attempting to delete table...');
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId);

    if (error) {
      console.error('[TABLES API] Error deleting table:', error);
      return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
    }

    console.log('[TABLES API] Table deleted successfully:', tableId);
    return NextResponse.json({ success: true, deletedTable: existingTable });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
