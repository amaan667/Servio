import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, table_id, venue_id, order_id, destination_table_id } = body;

    if (!action || !table_id || !venue_id) {
      return NextResponse.json({ error: 'action, table_id, and venue_id are required' }, { status: 400 });
    }

    const supabase = await createClient();

    switch (action) {
      case 'start_preparing':
        return await handleStartPreparing(supabase, table_id, order_id);
      
      case 'mark_ready':
        return await handleMarkReady(supabase, table_id, order_id);
      
      case 'mark_served':
        return await handleMarkServed(supabase, table_id, order_id);
      
      case 'mark_awaiting_bill':
        return await handleMarkAwaitingBill(supabase, table_id);
      
      case 'close_table':
        return await handleCloseTable(supabase, table_id);
      
      case 'reserve_table':
        return await handleReserveTable(supabase, table_id);
      
      case 'move_table':
        if (!destination_table_id) {
          return NextResponse.json({ error: 'destination_table_id is required for move_table action' }, { status: 400 });
        }
        return await handleMoveTable(supabase, table_id, destination_table_id);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[TABLE SESSIONS ACTIONS API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleStartPreparing(supabase: any, table_id: string, order_id: string) {
  // Update order status to IN_PREP
  const { error: orderError } = await supabase
    .from('orders')
    .update({ 
      order_status: 'IN_PREP',
      updated_at: new Date().toISOString()
    })
    .eq('id', order_id);

  if (orderError) {
    console.error('[TABLE ACTIONS] Error updating order status:', orderError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'IN_PREP',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .eq('order_id', order_id);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkReady(supabase: any, table_id: string, order_id: string) {
  // Update order status to READY
  const { error: orderError } = await supabase
    .from('orders')
    .update({ 
      order_status: 'READY',
      updated_at: new Date().toISOString()
    })
    .eq('id', order_id);

  if (orderError) {
    console.error('[TABLE ACTIONS] Error updating order status:', orderError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'READY',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .eq('order_id', order_id);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkServed(supabase: any, table_id: string, order_id: string) {
  // Update order status to SERVED
  const { error: orderError } = await supabase
    .from('orders')
    .update({ 
      order_status: 'SERVED',
      updated_at: new Date().toISOString()
    })
    .eq('id', order_id);

  if (orderError) {
    console.error('[TABLE ACTIONS] Error updating order status:', orderError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'SERVED',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .eq('order_id', order_id);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkAwaitingBill(supabase: any, table_id: string) {
  // Update table session status to AWAITING_BILL
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'AWAITING_BILL',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .is('closed_at', null);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleCloseTable(supabase: any, table_id: string) {
  // Close current session
  const { error: closeError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .is('closed_at', null);

  if (closeError) {
    console.error('[TABLE ACTIONS] Error closing session:', closeError);
    return NextResponse.json({ error: 'Failed to close table session' }, { status: 500 });
  }

  // Create new FREE session
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('venue_id')
    .eq('id', table_id)
    .single();

  if (tableError) {
    console.error('[TABLE ACTIONS] Error fetching table:', tableError);
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 });
  }

  const { error: newSessionError } = await supabase
    .from('table_sessions')
    .insert({
      venue_id: table.venue_id,
      table_id,
      status: 'FREE',
      opened_at: new Date().toISOString(),
    });

  if (newSessionError) {
    console.error('[TABLE ACTIONS] Error creating new session:', newSessionError);
    return NextResponse.json({ error: 'Failed to create new session' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleReserveTable(supabase: any, table_id: string) {
  // Update table session status to RESERVED
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'RESERVED',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .is('closed_at', null);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMoveTable(supabase: any, table_id: string, destination_table_id: string) {
  // Get current session
  const { data: currentSession, error: sessionError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('table_id', table_id)
    .is('closed_at', null)
    .single();

  if (sessionError || !currentSession) {
    console.error('[TABLE ACTIONS] Error fetching current session:', sessionError);
    return NextResponse.json({ error: 'No active session found for table' }, { status: 400 });
  }

  // Check if destination table is FREE
  const { data: destSession, error: destError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('table_id', destination_table_id)
    .is('closed_at', null)
    .single();

  if (destError || !destSession || destSession.status !== 'FREE') {
    return NextResponse.json({ error: 'Destination table is not available' }, { status: 400 });
  }

  // Close current session
  const { error: closeError } = await supabase
    .from('table_sessions')
    .update({ 
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', currentSession.id);

  if (closeError) {
    console.error('[TABLE ACTIONS] Error closing current session:', closeError);
    return NextResponse.json({ error: 'Failed to close current session' }, { status: 500 });
  }

  // Update destination session with current session data
  const { error: updateError } = await supabase
    .from('table_sessions')
    .update({ 
      status: currentSession.status,
      order_id: currentSession.order_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', destSession.id);

  if (updateError) {
    console.error('[TABLE ACTIONS] Error updating destination session:', updateError);
    return NextResponse.json({ error: 'Failed to update destination session' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
