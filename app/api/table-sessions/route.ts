import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venue_id, table_id, status, order_id } = body;

    if (!venue_id || !table_id || !status) {
      return NextResponse.json({ error: 'venue_id, table_id, and status are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Create new table session
    const { data: session, error } = await supabase
      .from('table_sessions')
      .insert({
        venue_id,
        table_id,
        status,
        order_id: order_id || null,
        opened_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[TABLE SESSIONS API] Error creating session:', error);
      return NextResponse.json({ error: 'Failed to create table session' }, { status: 500 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('[TABLE SESSIONS API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
