import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
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
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get table status using the function
    const { data: tableStatus, error } = await supabase
      .rpc('get_table_status', { p_venue_id: venueId });

    if (error) {
      logger.error('[POS TABLE SESSIONS] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tables: tableStatus });
  } catch (error) {
    logger.error('[POS TABLE SESSIONS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venue_id, table_id, action, server_id, guest_count, notes } = body;

    if (!venue_id || !table_id || !action) {
      return NextResponse.json({ error: 'venue_id, table_id, and action are required' }, { status: 400 });
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
      case 'seat_party':
        // Create new table session
        const { data: session, error: sessionError } = await supabase
          .from('table_sessions')
          .insert({
            venue_id,
            table_id,
            server_id: server_id || user.id,
            guest_count: guest_count || 1,
            notes,
            status: 'OCCUPIED'
          })
          .select()
          .single();

        if (sessionError) {
          logger.error('[POS TABLE SESSIONS] Error creating session:', sessionError);
          return NextResponse.json({ error: 'Failed to create table session' }, { status: 500 });
        }

        result = { session, action: 'seated' };
        break;

      case 'close_tab':
        // Close table session
        const { data: closedSession, error: closeError } = await supabase
          .from('table_sessions')
          .update({ 
            closed_at: new Date().toISOString(),
            status: 'CLEANING'
          })
          .eq('venue_id', venue_id)
          .eq('table_id', table_id)
          .eq('closed_at', null)
          .select()
          .single();

        if (closeError) {
          logger.error('[POS TABLE SESSIONS] Error closing session:', closeError);
          return NextResponse.json({ error: 'Failed to close table session' }, { status: 500 });
        }

        // Mark all active orders as completed
        const { error: ordersError } = await supabase
          .from('orders')
          .update({ order_status: 'COMPLETED' })
          .eq('venue_id', venue_id)
          .eq('table_id', table_id)
          .eq('is_active', true);

        if (ordersError) {
          logger.error('[POS TABLE SESSIONS] Error completing orders:', ordersError);
        }

        result = { session: closedSession, action: 'closed' };
        break;

      case 'mark_cleaning':
        // Mark table as cleaning
        const { data: cleaningSession, error: cleaningError } = await supabase
          .from('table_sessions')
          .update({ status: 'CLEANING' })
          .eq('venue_id', venue_id)
          .eq('table_id', table_id)
          .eq('closed_at', null)
          .select()
          .single();

        if (cleaningError) {
          logger.error('[POS TABLE SESSIONS] Error marking cleaning:', cleaningError);
          return NextResponse.json({ error: 'Failed to mark table as cleaning' }, { status: 500 });
        }

        result = { session: cleaningSession, action: 'cleaning' };
        break;

      case 'mark_free':
        // Mark table as free
        const { data: freeSession, error: freeError } = await supabase
          .from('table_sessions')
          .update({ 
            status: 'FREE',
            closed_at: new Date().toISOString()
          })
          .eq('venue_id', venue_id)
          .eq('table_id', table_id)
          .eq('closed_at', null)
          .select()
          .single();

        if (freeError) {
          logger.error('[POS TABLE SESSIONS] Error marking free:', freeError);
          return NextResponse.json({ error: 'Failed to mark table as free' }, { status: 500 });
        }

        result = { session: freeSession, action: 'free' };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[POS TABLE SESSIONS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
