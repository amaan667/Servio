import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get tables with their current session and order info
    const { data: tables, error } = await supabase
      .from('tables_with_sessions')
      .select('*')
      .eq('venue_id', venueId)
      .order('label', { ascending: true });

    if (error) {
      console.error('[TABLES API] Error fetching tables:', error);
      return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
    }

    return NextResponse.json({ tables });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venue_id, label, seat_count, qr_version } = body;

    if (!venue_id || !label) {
      return NextResponse.json({ error: 'venue_id and label are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify venue exists and user has access
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
    }

    // Create table
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .insert({
        venue_id,
        label: label.trim(),
        seat_count: seat_count || 2,
        qr_version: qr_version || 1,
      })
      .select()
      .single();

    if (tableError) {
      console.error('[TABLES API] Error creating table:', tableError);
      return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
