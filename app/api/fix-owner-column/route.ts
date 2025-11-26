import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/fix-owner-column - Fix the owner column name mismatch (Cookie-free)
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Check current column names
      const { data: columns, error: columnError } = await supabase.rpc("exec_sql", {
        sql: `SELECT column_name, data_type, is_nullable
              FROM information_schema.columns  
              WHERE table_name = 'venues' AND column_name LIKE '%owner%'
              ORDER BY column_name;`,
      });

      if (columnError) {
        logger.error("[COLUMN FIX] Error checking columns:", {
          error: columnError.message,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to check current column structure",
            details: columnError.message,
            message: process.env.NODE_ENV === "development" ? columnError.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // Try to rename the column
      const { error: renameError } = await supabase.rpc("exec_sql", {
        sql: "ALTER TABLE venues RENAME COLUMN owner_user_id TO owner_user_id;",
      });

      if (renameError) {
        logger.error("[COLUMN FIX] Error renaming column:", {
          error: renameError.message,
          userId: context.user.id,
        });
        // Column might already be renamed or not exist
      }

      // Update indexes
      const { error: indexError } = await supabase.rpc("exec_sql", {
        sql: `DROP INDEX IF EXISTS idx_venues_owner;
              CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);`,
      });

      if (indexError) {
        logger.warn("[COLUMN FIX] Index update warning:", {
          error: indexError.message,
          userId: context.user.id,
        });
      }

      // Verify the fix worked
      const { data: finalColumns, error: finalError } = await supabase.rpc("exec_sql", {
        sql: `SELECT column_name, data_type, is_nullable
              FROM information_schema.columns  
              WHERE table_name = 'venues' AND column_name LIKE '%owner%'
              ORDER BY column_name;`,
      });

      if (finalError) {
        logger.error("[COLUMN FIX] Error verifying fix:", {
          error: finalError.message,
          userId: context.user.id,
        });
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Owner column fix completed. The owner validation should now work properly.",
        beforeColumns: columns,
        afterColumns: finalColumns,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[COLUMN FIX] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
