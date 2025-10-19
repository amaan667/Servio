import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
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

    const now = new Date().toISOString();

    // Find reservations that should be auto-completed
    // 1. Time-based: reservations that have passed their end time
    // 2. Payment-based: CHECKED_IN reservations where all orders are paid and completed
    const { data: allActiveReservations, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('venue_id', venueId)
      .in('status', ['BOOKED', 'CHECKED_IN']);

    if (fetchError) {
      logger.error('[AUTO COMPLETE] Error fetching active reservations:', fetchError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to fetch active reservations' 
      }, { status: 500 });
    }

    if (!allActiveReservations || allActiveReservations.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No active reservations found',
        completedCount: 0
      });
    }

    const reservationsToComplete = [];

    for (const reservation of allActiveReservations) {
      let shouldComplete = false;
      let completionReason = '';

      // Check time-based completion
      if (new Date(reservation.end_at) < new Date(now)) {
        shouldComplete = true;
        completionReason = 'time_expired';
      }
      // Check payment-based completion for CHECKED_IN reservations
      else if (reservation.status === 'CHECKED_IN' && reservation.table_id) {
        // Find all orders for this table that are not completed
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id, payment_status, order_status')
          .eq('venue_id', venueId)
          .eq('table_id', reservation.table_id)
          .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING']);

        // If there are no active orders, check if all orders are paid
        if (!activeOrders || activeOrders.length === 0) {
          const { data: allOrders } = await supabase
            .from('orders')
            .select('payment_status')
            .eq('venue_id', venueId)
            .eq('table_id', reservation.table_id)
            .eq('payment_status', 'PAID');

          // If there are paid orders and no active orders, complete the reservation
          if (allOrders && allOrders.length > 0) {
            shouldComplete = true;
            completionReason = 'payment_completed';
          }
        }
      }

      if (shouldComplete) {
        reservationsToComplete.push({
          ...reservation,
          completionReason
        });
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
      logger.error('[AUTO COMPLETE] Error updating reservations:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to complete reservations' 
      }, { status: 500 });
    }

    // Also check if any tables should be set to FREE if they have no active orders
    for (const reservation of reservationsToComplete) {
      if (reservation.table_id) {
        // Check if there are any active orders for this table
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('table_id', reservation.table_id)
          .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING'])
          .limit(1);

        // If no active orders, set table session to FREE
        if (!activeOrders || activeOrders.length === 0) {
          await supabase
            .from('table_sessions')
            .upsert({
              table_id: reservation.table_id,
              status: 'FREE',
              closed_at: now,
              updated_at: now
            }, {
              onConflict: 'table_id'
            });
        }
      }
    }


    return NextResponse.json({
      ok: true,
      message: `Completed ${updatedReservations?.length || 0} reservations`,
      completedCount: updatedReservations?.length || 0,
      reservations: updatedReservations,
      completionReasons: reservationsToComplete.map(r => ({
        id: r.id,
        reason: r.completionReason
      }))
    });

  } catch (error: any) {
    logger.error('[AUTO COMPLETE] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
