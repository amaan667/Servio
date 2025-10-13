import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/tables/[tableId]/close - Close a table
export async function POST(
  req: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await context.params;

    if (!tableId) {
      return NextResponse.json({ ok: false, error: 'tableId is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();

    // Get table info to check venue ownership
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('venue_id')
      .eq('id', tableId)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ ok: false, error: 'Table not found' }, { status: 404 });
    }

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', table.venue_id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Call the database function to close the table
    const { error } = await supabase.rpc('api_close_table', {
      p_table_id: tableId,
      p_venue_id: table.venue_id
    });

    if (error) {
      console.error('[TABLES CLOSE] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Table closed successfully'
    });

  } catch (error) {
    console.error('[TABLES CLOSE] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}