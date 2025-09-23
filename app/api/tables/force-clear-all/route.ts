import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    console.log('[FORCE CLEAR ALL] Force clearing ALL tables and sessions for venue:', venue_id);

    const supabase = await createAdminClient();

    // Step 1: Force clear ALL table references from orders (including completed ones)
    console.log('[FORCE CLEAR ALL] Step 1: Force clearing ALL table references from orders...');
    const { error: clearAllRefsError } = await supabase
      .from('orders')
      .update({ table_id: null })
      .eq('venue_id', venue_id);

    if (clearAllRefsError) {
      console.error('[FORCE CLEAR ALL] Error clearing table references:', clearAllRefsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to clear table references: ${clearAllRefsError.message}` 
      }, { status: 500 });
    }

    console.log('[FORCE CLEAR ALL] All table references cleared successfully');

    // Step 2: Delete all table sessions
    console.log('[FORCE CLEAR ALL] Step 2: Deleting all table sessions...');
    const { error: sessionsError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('venue_id', venue_id);

    if (sessionsError) {
      console.error('[FORCE CLEAR ALL] Error deleting table sessions:', sessionsError);
      // Continue anyway
    } else {
      console.log('[FORCE CLEAR ALL] Table sessions deleted successfully');
    }

    // Step 3: Delete all tables
    console.log('[FORCE CLEAR ALL] Step 3: Deleting all tables...');
    const { error: tablesError } = await supabase
      .from('tables')
      .delete()
      .eq('venue_id', venue_id);

    if (tablesError) {
      console.error('[FORCE CLEAR ALL] Error deleting tables:', tablesError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to delete tables: ${tablesError.message}` 
      }, { status: 500 });
    }

    console.log('[FORCE CLEAR ALL] All tables deleted successfully');

    // Step 4: Clear table runtime state
    console.log('[FORCE CLEAR ALL] Step 4: Clearing table runtime state...');
    const { error: runtimeError } = await supabase
      .from('table_runtime_state')
      .delete()
      .eq('venue_id', venue_id);

    if (runtimeError) {
      console.error('[FORCE CLEAR ALL] Error clearing runtime state:', runtimeError);
      // Continue anyway
    } else {
      console.log('[FORCE CLEAR ALL] Table runtime state cleared successfully');
    }

    // Step 5: Clear group sessions
    console.log('[FORCE CLEAR ALL] Step 5: Clearing group sessions...');
    const { error: groupSessionsError } = await supabase
      .from('table_group_sessions')
      .delete()
      .eq('venue_id', venue_id);

    if (groupSessionsError) {
      console.error('[FORCE CLEAR ALL] Error clearing group sessions:', groupSessionsError);
      // Continue anyway
    } else {
      console.log('[FORCE CLEAR ALL] Group sessions cleared successfully');
    }

    console.log('[FORCE CLEAR ALL] Force clear completed successfully for venue:', venue_id);

    return NextResponse.json({ 
      ok: true, 
      message: 'All tables and sessions force cleared successfully' 
    });

  } catch (error) {
    console.error('[FORCE CLEAR ALL] Error in force clear all tables API:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
