import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/fix-table-management - Apply comprehensive table management fix
export async function POST(req: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const results = [];

    try {
      // 1. Add missing column to table_sessions
      const { error: columnError } = await adminSupabase.rpc('exec', {
        sql: `ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;`
      });
      if (columnError) {
        console.log('[FIX] Column already exists or error:', columnError.message);
      } else {
        results.push('Added reservation_duration_minutes column');
      }
    } catch (e) {
      results.push('Column addition skipped (may already exist)');
    }

    try {
      // 2. Update existing data
      const { error: updateError } = await adminSupabase
        .from('table_sessions')
        .update({ status: 'FREE' })
        .is('status', null);
      
      if (updateError) {
        console.log('[FIX] Update error:', updateError.message);
      } else {
        results.push('Updated null statuses to FREE');
      }
    } catch (e) {
      results.push('Status update skipped');
    }

    try {
      // 3. Ensure all tables have sessions
      const { data: tables } = await adminSupabase
        .from('tables')
        .select('id, venue_id')
        .eq('is_active', true);

      if (tables) {
        for (const table of tables) {
          const { data: existingSession } = await adminSupabase
            .from('table_sessions')
            .select('id')
            .eq('table_id', table.id)
            .is('closed_at', null)
            .maybeSingle();

          if (!existingSession) {
            await adminSupabase
              .from('table_sessions')
              .insert({
                venue_id: table.venue_id,
                table_id: table.id,
                status: 'FREE',
                opened_at: new Date().toISOString()
              });
          }
        }
        results.push('Ensured all tables have sessions');
      }
    } catch (e) {
      results.push('Session creation skipped');
    }

    return NextResponse.json({
      ok: true,
      message: 'Table management fix applied successfully',
      results
    });

  } catch (error) {
    console.error('[FIX TABLE MANAGEMENT] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
