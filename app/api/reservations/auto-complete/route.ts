import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth';

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
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Forbidden' 
      }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Find reservations that have passed their end time and are still active
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('venue_id', venueId)
      .in('status', ['BOOKED', 'CHECKED_IN'])
      .lt('end_at', now);

    if (fetchError) {
      console.error('[AUTO COMPLETE] Error fetching expired reservations:', fetchError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to fetch expired reservations' 
      }, { status: 500 });
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No expired reservations found',
        completedCount: 0
      });
    }

    // Update expired reservations to COMPLETED status
    const { data: updatedReservations, error: updateError } = await supabase
      .from('reservations')
      .update({ 
        status: 'COMPLETED',
        updated_at: now
      })
      .in('id', expiredReservations.map(r => r.id))
      .select();

    if (updateError) {
      console.error('[AUTO COMPLETE] Error updating reservations:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to complete expired reservations' 
      }, { status: 500 });
    }

    // Also check if any tables should be set to FREE if they have no active orders
    for (const reservation of expiredReservations) {
      if (reservation.table_id) {
        // Check if there are any active orders for this table
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('table_number', reservation.table_id)
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

    console.log('[AUTO COMPLETE] Successfully completed', updatedReservations?.length || 0, 'expired reservations');

    return NextResponse.json({
      ok: true,
      message: `Completed ${updatedReservations?.length || 0} expired reservations`,
      completedCount: updatedReservations?.length || 0,
      reservations: updatedReservations
    });

  } catch (error: any) {
    console.error('[AUTO COMPLETE] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
