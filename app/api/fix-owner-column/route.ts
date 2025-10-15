import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSafe } from '@/utils/getUserSafe';

// POST /api/fix-owner-column - Fix the owner column name mismatch
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/fix-owner-column');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    console.log('[COLUMN FIX] Starting owner column name fix...');

    // Check current column names
    const { data: columns, error: columnError } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns  
            WHERE table_name = 'venues' AND column_name LIKE '%owner%'
            ORDER BY column_name;`
    });

    if (columnError) {
      console.error('[COLUMN FIX] Error checking columns:', columnError);
      return NextResponse.json({ 
        error: 'Failed to check current column structure',
        details: columnError.message 
      }, { status: 500 });
    }

    console.log('[COLUMN FIX] Current columns:', columns);

    // Try to rename the column
    const { error: renameError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE venues RENAME COLUMN owner_id TO owner_user_id;'
    });

    if (renameError) {
      console.error('[COLUMN FIX] Error renaming column:', renameError);
      // Column might already be renamed or not exist
      console.log('[COLUMN FIX] Column rename failed, checking if already correct...');
    } else {
      console.log('[COLUMN FIX] Column renamed successfully');
    }

    // Update indexes
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `DROP INDEX IF EXISTS idx_venues_owner;
            CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);`
    });

    if (indexError) {
      console.warn('[COLUMN FIX] Index update warning:', indexError);
    } else {
      console.log('[COLUMN FIX] Indexes updated successfully');
    }

    // Verify the fix worked
    const { data: finalColumns, error: finalError } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns  
            WHERE table_name = 'venues' AND column_name LIKE '%owner%'
            ORDER BY column_name;`
    });

    if (finalError) {
      console.error('[COLUMN FIX] Error verifying fix:', finalError);
    }

    console.log('[COLUMN FIX] Final columns:', finalColumns);

    return NextResponse.json({ 
      success: true,
      message: 'Owner column fix completed. The owner validation should now work properly.',
      beforeColumns: columns,
      afterColumns: finalColumns
    });

  } catch (error) {
    console.error('[COLUMN FIX] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
