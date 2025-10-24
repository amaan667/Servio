import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Step 1: Delete all table sessions for this venue
    const { error: sessionsError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('venue_id', venue_id);

    if (sessionsError) {
      logger.error('[AUTH DEBUG] Error deleting table sessions:', sessionsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to delete table sessions: ${sessionsError.message}` 
      }, { status: 500 });
    }

    // Step 2: Delete all tables for this venue
    const { error: tablesError } = await supabase
      .from('tables')
      .delete()
      .eq('venue_id', venue_id);

    if (tablesError) {
      logger.error('[AUTH DEBUG] Error deleting tables:', tablesError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to delete tables: ${tablesError.message}` 
      }, { status: 500 });
    }

    // Step 3: Table runtime state is a view and will update automatically
    // when we delete the base tables and sessions above

    return NextResponse.json({ 
      ok: true, 
      message: 'All tables and sessions cleared successfully' 
    });

  } catch (_error) {
    logger.error('[AUTH DEBUG] Error in clear all tables API:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
