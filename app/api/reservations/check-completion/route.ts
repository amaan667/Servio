import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { venueId, tableId } = await req.json();

    if (!venueId || !tableId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId and tableId are required' 
      }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Forbidden' 
      }, { status: 403 });
    }

    // Find CHECKED_IN reservations for this table
    const { data: checkedInReservations, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('venue_id', venueId)
      .eq('table_id', tableId)
      .eq('status', 'CHECKED_IN');

    if (fetchError) {
      logger.error('[CHECK COMPLETION] Error fetching reservations:', fetchError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to fetch reservations' 
      }, { status: 500 });
    }

    if (!checkedInReservations || checkedInReservations.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No checked-in reservations found for this table',
        completedCount: 0
      });
    }

    const now = new Date().toISOString();
    const reservationsToComplete = [];

    for (const reservation of checkedInReservations) {
      // Check if all orders for this table are paid and completed
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, payment_status, order_status')
        .eq('venue_id', venueId)
        .eq('table_id', tableId)
        .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING']);

      // If there are no active orders, check if all orders are paid
      if (!activeOrders || activeOrders.length === 0) {
        const { data: allOrders } = await supabase
          .from('orders')
          .select('payment_status')
          .eq('venue_id', venueId)
          .eq('table_id', tableId)
          .eq('payment_status', 'PAID');

        // If there are paid orders and no active orders, complete the reservation
        if (allOrders && allOrders.length > 0) {
          reservationsToComplete.push(reservation);
        }
      }
    }

    if (reservationsToComplete.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No reservations need to be completed',
        completedCount: 0
      });
    }

    // Update reservations to COMPLETED status
    const { data: updatedReservations, error: updateError } = await supabase
      .from('reservations')
      .update({ 
        status: 'COMPLETED',
        updated_at: now
      })
      .in('id', reservationsToComplete.map(r => r.id))
      .select();

    if (updateError) {
      logger.error('[CHECK COMPLETION] Error updating reservations:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to complete reservations' 
      }, { status: 500 });
    }

    // Set table session to FREE if no active orders
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('venue_id', venueId)
      .eq('table_id', tableId)
      .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING'])
      .limit(1);

    if (!activeOrders || activeOrders.length === 0) {
      await supabase
        .from('table_sessions')
        .upsert({
          table_id: tableId,
          status: 'FREE',
          closed_at: now,
          updated_at: now
        }, {
          onConflict: 'table_id'
        });
    }


    return NextResponse.json({
      ok: true,
      message: `Completed ${updatedReservations?.length || 0} reservations`,
      completedCount: updatedReservations?.length || 0,
      reservations: updatedReservations
    });

  } catch (error: any) {
    logger.error('[CHECK COMPLETION] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
