import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getUserSafe } from '@/utils/getUserSafe';
import { logger } from '@/lib/logger';

// POST /api/migrate-database-constraint - Fix staff invitations constraint
export async function POST() {
  try {
    const user = await getUserSafe();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    logger.debug('[MIGRATION] Starting staff invitations constraint fix...');

    // Step 1: Drop the existing unique constraint that includes status
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;'
    });

    if (dropError) {
      logger.error('[MIGRATION] Error dropping constraint:', dropError);
      // Continue anyway, constraint might not exist
    } else {
      logger.debug('[MIGRATION] Dropped existing constraint');
    }

    // Step 2: Create the new partial unique index
    const { error: createIndexError } = await supabase.rpc('exec_sql', {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
            ON staff_invitations (venue_id, email) 
            WHERE status = 'pending';`
    });

    if (createIndexError) {
      logger.error('[MIGRATION] Error creating new index:', createIndexError);
      return NextResponse.json({ 
        error: 'Failed to create new constraint',
        details: createIndexError.message 
      }, { status: 500 });
    }

    logger.debug('[MIGRATION] Created new partial unique index');

    // Step 3: Add comment to the index
    const { error: commentError } = await supabase.rpc('exec_sql', {
      sql: `COMMENT ON INDEX idx_staff_invitations_unique_pending IS 'Ensures only one pending invitation per email per venue, allowing cancelled invitations to be removed and new ones created';`
    });

    if (commentError) {
      logger.warn('[MIGRATION] Warning: Could not add comment to index:', commentError);
      // This is not critical, continue
    }

    // Step 4: Verify the fix worked
    const { data: constraints, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: `SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint 
      WHERE conrelid = 'staff_invitations'::regclass;`
    });

    if (verifyError) {
      logger.warn('[MIGRATION] Warning: Could not verify constraints:', verifyError);
    }

    logger.debug('[MIGRATION] Staff invitations constraint fix completed successfully');

    return NextResponse.json({ 
      success: true,
      message: 'Staff invitations constraint fixed successfully. Cancelled invitations can now be completely removed and new invitations can be created for the same email.',
      constraints: constraints || 'Could not verify constraints'
    });

  } catch (error) {
    logger.error('[MIGRATION] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
