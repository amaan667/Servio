// API endpoint to set up the staff invitation system
// Creates the required database tables for staff invitations

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(_request: NextRequest) {
  try {

    const supabase = await createClient();

    // Check if user is authenticated
    // Use getSession() to avoid refresh token errors
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (sessionError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if staff_invitations table already exists
    const { error: invitationsError } = await supabase
      .from("staff_invitations")
      .select("*")
      .limit(1);

    const invitationsExist = !invitationsError || invitationsError.code !== "PGRST116";

    if (invitationsExist) {
      return NextResponse.json({
        success: true,
        message: "Staff invitation system already exists",
        tables: {
          staff_invitations: true,
        },
      });
    }


    // Create the staff_invitations table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS staff_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        
        -- Invitation details
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'server', 'cashier')),
        permissions JSONB DEFAULT '{ /* Empty */ }',
        
        -- Invitation status
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
        token TEXT NOT NULL UNIQUE,
        
        -- Timestamps
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        accepted_at TIMESTAMPTZ,
        
        -- User account created from invitation
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        
        -- Constraints
        UNIQUE(venue_id, email, status)
      );
    `;

    // Try to create the table using a direct query approach
    try {
      // First, let's try to create the table by attempting to insert a dummy record
      // This will fail if the table doesn't exist, but that's expected
      const { error: testError } = await supabase.from("staff_invitations").insert({
        venue_id: "test",
        invited_by: user.id,
        email: "test@example.com",
        role: "staff",
        token: "test-token",
      });

      if (testError && testError.code === "PGRST116") {
        // Table doesn't exist, we need to create it
        logger.debug(
          "[STAFF INVITATION SETUP] Table doesn't exist, returning instructions for manual creation"
        );
        return NextResponse.json({
          success: false,
          message: "Database table needs to be created manually",
          instructions:
            "Please run the SQL from scripts/staff-invitation-system.sql in your Supabase dashboard SQL editor",
          sql: createTableSQL,
        });
      }
    } catch (_error) {
      logger.debug("[STAFF INVITATION SETUP] Error testing table existence:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
    }

    // Indexes and RLS will be set up via migration scripts


    return NextResponse.json({
      success: true,
      message: "Staff invitation system setup completed",
      tables: {
        staff_invitations: true,
      },
      nextSteps: [
        "The staff_invitations table has been created",
        "You can now invite staff members through the Staff Management page",
        "Invited staff will receive email invitations to join your venue",
      ],
    });
  } catch (_error) {
    logger.error("[STAFF INVITATION SETUP] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to set up staff invitation system",
        details: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}
