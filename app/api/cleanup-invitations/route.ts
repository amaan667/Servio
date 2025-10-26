import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getUserSafe } from '@/utils/getUserSafe';
import { logger } from '@/lib/logger';

// POST /api/cleanup-invitations - Clean up cancelled invitations and fix constraint
export async function POST() {
  try {
    const user = await getUserSafe();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    logger.debug('[CLEANUP] Starting invitation cleanup...');

    // Step 1: Delete all cancelled invitations to clean up the database
    const { data: deletedInvitations, error: deleteError } = await supabase
      .from('staff_invitations')
      .delete()
      .eq('status', 'cancelled')
      .select('id, email, venue_id');

    if (deleteError) {
      logger.error('[CLEANUP] Error deleting cancelled invitations:', { error: deleteError.message || 'Unknown error' });
      return NextResponse.json({ 
        error: 'Failed to clean up cancelled invitations',
        details: deleteError.message 
      }, { status: 500 });
    }

    logger.debug(`[CLEANUP] Deleted ${deletedInvitations?.length || 0} cancelled invitations`);

    // Step 2: Try to fix the database constraint
    try {
      // Drop the problematic constraint
      await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;'
      });

      // Create the new partial unique index
      await supabase.rpc('exec_sql', {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
              ON staff_invitations (venue_id, email) 
              WHERE status = 'pending';`
      });

      logger.debug('[CLEANUP] Database constraint fixed successfully');
    } catch (constraintError) {
      logger.warn('[CLEANUP] Could not fix constraint (this is okay)', { error: constraintError instanceof Error ? constraintError.message : 'Unknown error' });
    }

    return NextResponse.json({ 
      success: true,
      message: `Cleanup completed successfully. Deleted ${deletedInvitations?.length || 0} cancelled invitations.`,
      deletedCount: deletedInvitations?.length || 0
    });

  } catch (_error) {
    logger.error('[CLEANUP] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
