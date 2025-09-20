import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/tables/secondary?primary_table_id=xxx&venue_id=xxx - Find secondary table for a primary table
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const primaryTableId = searchParams.get('primary_table_id');
    const venueId = searchParams.get('venue_id');

    if (!primaryTableId || !venueId) {
      return NextResponse.json({ ok: false, error: 'primary_table_id and venue_id are required' }, { status: 400 });
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

    // Find the secondary table that is merged with the primary table
    const { data: secondaryTable, error: secondaryTableError } = await supabase
      .from('tables')
      .select('*')
      .eq('venue_id', venueId)
      .eq('merged_with_table_id', primaryTableId)
      .single();

    if (secondaryTableError) {
      console.error('[TABLES SECONDARY GET] Error finding secondary table:', secondaryTableError);
      if (secondaryTableError.code === 'PGRST116') {
        return NextResponse.json({ ok: false, error: 'No secondary table found for this primary table' }, { status: 404 });
      }
      return NextResponse.json({ ok: false, error: secondaryTableError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      table: secondaryTable
    });

  } catch (error) {
    console.error('[TABLES SECONDARY GET] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
