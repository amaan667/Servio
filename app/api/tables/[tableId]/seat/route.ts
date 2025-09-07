import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { tableId } = params;
    const body = await request.json();
    const { reservationId, serverId } = body;

    if (!tableId) {
      return NextResponse.json(
        { error: 'tableId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase.rpc('api_seat_party', {
      p_table_id: tableId,
      p_reservation_id: reservationId || null,
      p_server_id: serverId || null
    });

    if (error) {
      console.error('Error seating party:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in seat party API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
