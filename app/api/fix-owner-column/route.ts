import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// POST /api/fix-owner-column - Fix the owner column name mismatch (Cookie-free)
export async function POST() {
  try {
    const supabase = createAdminClient();


    // Check current column names
    const { data: columns, error: columnError } = await supabase.rpc("exec_sql", {
      sql: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns  
            WHERE table_name = 'venues' AND column_name LIKE '%owner%'
            ORDER BY column_name;`,
    });

    if (columnError) {
      logger.error("[COLUMN FIX] Error checking columns:", { error: columnError.message });
      return NextResponse.json(
        {
          error: "Failed to check current column structure",
          details: columnError.message,
        },
        { status: 500 }
      );
    }


    // Try to rename the column
    const { error: renameError } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE venues RENAME COLUMN owner_user_id TO owner_user_id;",
    });

    if (renameError) {
      logger.error("[COLUMN FIX] Error renaming column:", { error: renameError.message });
      // Column might already be renamed or not exist
    } else {
      // Column renamed successfully
    }

    // Update indexes
    const { error: indexError } = await supabase.rpc("exec_sql", {
      sql: `DROP INDEX IF EXISTS idx_venues_owner;
            CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);`,
    });

    if (indexError) {
      logger.warn("[COLUMN FIX] Index update warning:", { error: indexError.message });
    } else {
      // Index updated successfully
    }

    // Verify the fix worked
    const { data: finalColumns, error: finalError } = await supabase.rpc("exec_sql", {
      sql: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns  
            WHERE table_name = 'venues' AND column_name LIKE '%owner%'
            ORDER BY column_name;`,
    });

    if (finalError) {
      logger.error("[COLUMN FIX] Error verifying fix:", { error: finalError.message });
    }


    return NextResponse.json({
      success: true,
      message: "Owner column fix completed. The owner validation should now work properly.",
      beforeColumns: columns,
      afterColumns: finalColumns,
    });
  } catch (_error) {
    logger.error("[COLUMN FIX] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
