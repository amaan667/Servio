import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/tables?venueId=xxx - Get table runtime state for a venue
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
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
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Get table runtime state using the view
    const { data: tables, error } = await supabase
      .from('table_runtime_state')
      .select('*')
      .eq('venue_id', venueId)
      .order('label');

    if (error) {
      console.error('[TABLES GET] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      tables: tables || []
    });

  } catch (error) {
    console.error('[TABLES GET] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tables - Create a new table
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venue_id, label, seat_count, area } = body;

    if (!venue_id || !label) {
      return NextResponse.json({ ok: false, error: 'venue_id and label are required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Create table
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .insert({
        venue_id: venue_id,
        label: label,
        seat_count: seat_count || 2,
        area: area || null
      })
      .select()
      .single();

    if (tableError) {
      console.error('[TABLES POST] Table creation error:', tableError);
      return NextResponse.json({ ok: false, error: tableError.message }, { status: 500 });
    }

    // Create initial FREE session
    const { error: sessionError } = await supabase
      .from('table_sessions')
      .insert({
        venue_id: venue_id,
        table_id: table.id,
        status: 'FREE'
      });

    if (sessionError) {
      console.error('[TABLES POST] Session creation error:', sessionError);
      return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      table: table
    });

  } catch (error) {
    console.error('[TABLES POST] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}