import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { table_id, venue_id, reservation_id } = await req.json();

    if (!table_id || !venue_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Call the seat party function
    const { data, error } = await supabase.rpc('api_seat_party', {
      p_table_id: table_id,
      p_venue_id: venue_id,
      p_reservation_id: reservation_id || null,
      p_server_id: null // TODO: Get from auth context
    });

    if (error) {
      console.error('[SEAT PARTY API] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('[SEAT PARTY API] Success:', data);
    return NextResponse.json(data);

  } catch (error) {
    console.error('[SEAT PARTY API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
