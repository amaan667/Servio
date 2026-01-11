import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * API endpoint to create the get_invitation_by_token database function
 * This fixes the "invited_by_email" column error by properly joining with auth.users
 * Note: This is an admin function that requires authentication but doesn't need venue access
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {

            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)
      // Note: This is an admin function - consider adding admin role check

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // SQL to create the function
      const functionSQL = `
        -- Drop the function if it exists (in case it was created incorrectly)
        DROP FUNCTION IF EXISTS get_invitation_by_token(TEXT);

        -- Create the function to get invitation details by token
        -- This function joins with auth.users to get the inviter's name and email
        CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token TEXT)
        RETURNS TABLE (
          id UUID,
          venue_id TEXT,
          organization_id UUID,
          invited_by UUID,
          invited_by_name TEXT,
          invited_by_email TEXT,
          email TEXT,
          role TEXT,
          permissions JSONB,
          status TEXT,
          token TEXT,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ,
          accepted_at TIMESTAMPTZ,
          user_id UUID,
          venue_name TEXT
        ) 
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            si.id,
            si.venue_id,
            si.organization_id,
            si.invited_by,
            COALESCE(
              u.raw_user_meta_data->>'full_name',
              u.email,
              'Unknown'
            ) AS invited_by_name,
            u.email AS invited_by_email,
            si.email,
            si.role,
            si.permissions,
            si.status,
            si.token,
            si.expires_at,
            si.created_at,
            si.updated_at,
            si.accepted_at,
            si.user_id,
            v.venue_name
          FROM staff_invitations si
          LEFT JOIN auth.users u ON si.invited_by = u.id
          LEFT JOIN venues v ON si.venue_id = v.venue_id
          WHERE si.token = p_token;
        END;
        $$;
      `;

      // Execute the SQL using the raw query method
      // Note: This requires admin access - using admin client is appropriate here
      // For production, consider moving this to a migration script instead
      let error: { message: string } | null = null;
      try {
        // Attempt to execute via RPC if available
        const result = await (
          supabase as unknown as {
            rpc: (name: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;
          }
        ).rpc("exec_sql", { sql: functionSQL });
        error = result.error as { message: string } | null;
      } catch {
        error = { message: "exec_sql not available" };
      }

      if (
        error &&
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        error.message !== "exec_sql not available"
      ) {
        
        return NextResponse.json(
          {

          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({

    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {

          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required

  }
);
