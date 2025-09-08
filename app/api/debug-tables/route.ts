import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/debug-tables?venueId=xxx - Debug table schema and data
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id') || searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

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

    const debug: any = {
      venue_id: venueId,
      checks: {}
    };

    // Check if tables table exists and has data
    try {
      const { data: tables, error: tablesError } = await adminSupabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .limit(5);
      
      debug.checks.tables = {
        exists: !tablesError,
        error: tablesError?.message,
        count: tables?.length || 0,
        sample: tables?.[0] || null
      };
    } catch (e: any) {
      debug.checks.tables = { exists: false, error: e.message };
    }

    // Check if table_sessions table exists and has data
    try {
      const { data: sessions, error: sessionsError } = await adminSupabase
        .from('table_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .limit(5);
      
      debug.checks.table_sessions = {
        exists: !sessionsError,
        error: sessionsError?.message,
        count: sessions?.length || 0,
        sample: sessions?.[0] || null
      };
    } catch (e: any) {
      debug.checks.table_sessions = { exists: false, error: e.message };
    }

    // Check if table_runtime_state view exists
    try {
      const { data: runtimeState, error: runtimeError } = await adminSupabase
        .from('table_runtime_state')
        .select('*')
        .eq('venue_id', venueId)
        .limit(5);
      
      debug.checks.table_runtime_state = {
        exists: !runtimeError,
        error: runtimeError?.message,
        count: runtimeState?.length || 0,
        sample: runtimeState?.[0] || null
      };
    } catch (e: any) {
      debug.checks.table_runtime_state = { exists: false, error: e.message };
    }

    // Check if tables_with_sessions view exists
    try {
      const { data: tablesWithSessions, error: viewError } = await adminSupabase
        .from('tables_with_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .limit(5);
      
      debug.checks.tables_with_sessions = {
        exists: !viewError,
        error: viewError?.message,
        count: tablesWithSessions?.length || 0,
        sample: tablesWithSessions?.[0] || null
      };
    } catch (e: any) {
      debug.checks.tables_with_sessions = { exists: false, error: e.message };
    }

    return NextResponse.json({
      ok: true,
      debug
    });

  } catch (error) {
    console.error('[DEBUG TABLES] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
