import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Clearing table runtime state for venue:', venue_id);

    const supabase = await createAdminClient();

    // Clear table runtime state - reset all tables to FREE status
    const { error: runtimeStateError } = await supabase
      .from('table_runtime_state')
      .update({
        primary_status: 'FREE',
        session_id: null,
        opened_at: null,
        server_id: null,
        reservation_status: 'NONE',
        reserved_now_id: null,
        reserved_now_start: null,
        reserved_now_end: null,
        reserved_now_party_size: null,
        reserved_now_name: null,
        reserved_now_phone: null,
        next_reservation_id: null,
        next_reservation_start: null,
        next_reservation_end: null,
        next_reservation_party_size: null,
        next_reservation_name: null,
        next_reservation_phone: null
      })
      .eq('venue_id', venue_id);

    if (runtimeStateError) {
      console.error('[AUTH DEBUG] Error clearing table runtime state:', runtimeStateError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to clear table runtime state: ${runtimeStateError.message}` 
      }, { status: 500 });
    }

    console.log('[AUTH DEBUG] Table runtime state cleared successfully for venue:', venue_id);

    return NextResponse.json({ 
      ok: true, 
      message: 'Table runtime state cleared successfully' 
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Error in clear tables API:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
