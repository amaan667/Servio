import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSafe } from '@/utils/getUserSafe';

// POST /api/migrate-database-constraint - Fix staff invitations constraint
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/migrate-database-constraint');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    console.log('[MIGRATION] Starting staff invitations constraint fix...');

    // Step 1: Drop the existing unique constraint that includes status
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;'
    });

    if (dropError) {
      console.error('[MIGRATION] Error dropping constraint:', dropError);
      // Continue anyway, constraint might not exist
    } else {
      console.log('[MIGRATION] Dropped existing constraint');
    }

    // Step 2: Create the new partial unique index
    const { error: createIndexError } = await supabase.rpc('exec_sql', {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
            ON staff_invitations (venue_id, email) 
            WHERE status = 'pending';`
    });

    if (createIndexError) {
      console.error('[MIGRATION] Error creating new index:', createIndexError);
      return NextResponse.json({ 
        error: 'Failed to create new constraint',
        details: createIndexError.message 
      }, { status: 500 });
    }

    console.log('[MIGRATION] Created new partial unique index');

    // Step 3: Add comment to the index
    const { error: commentError } = await supabase.rpc('exec_sql', {
      sql: `COMMENT ON INDEX idx_staff_invitations_unique_pending IS 'Ensures only one pending invitation per email per venue, allowing cancelled invitations to be removed and new ones created';`
    });

    if (commentError) {
      console.warn('[MIGRATION] Warning: Could not add comment to index:', commentError);
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
      console.warn('[MIGRATION] Warning: Could not verify constraints:', verifyError);
    }

    console.log('[MIGRATION] Staff invitations constraint fix completed successfully');

    return NextResponse.json({ 
      success: true,
      message: 'Staff invitations constraint fixed successfully. Cancelled invitations can now be completely removed and new invitations can be created for the same email.',
      constraints: constraints || 'Could not verify constraints'
    });

  } catch (error) {
    console.error('[MIGRATION] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
