import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await context.params;

    if (!reservationId) {
      return NextResponse.json(
        { error: 'reservationId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc('api_no_show_reservation', {
      p_reservation_id: reservationId
    });

    if (error) {
      logger.error('Error marking reservation as no-show:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (_error) {
    logger.error('Error in no-show reservation API:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
