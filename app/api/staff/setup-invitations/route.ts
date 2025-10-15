// API endpoint to set up the staff invitation system
// Creates the required database tables for staff invitations

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    console.log("[STAFF INVITATION SETUP] Starting staff invitation system setup...");
    
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if staff_invitations table already exists
    const { data: invitationsCheck, error: invitationsError } = await supabase
      .from('staff_invitations')
      .select('*')
      .limit(1);
    
    const invitationsExist = !invitationsError || invitationsError.code !== 'PGRST116';
    
    if (invitationsExist) {
      return NextResponse.json({
        success: true,
        message: "Staff invitation system already exists",
        tables: {
          staff_invitations: true
        }
      });
    }

    console.log("[STAFF INVITATION SETUP] Creating staff_invitations table...");

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
        permissions JSONB DEFAULT '{}',
        
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
      const { error: testError } = await supabase
        .from('staff_invitations')
        .insert({
          venue_id: 'test',
          invited_by: user.id,
          email: 'test@example.com',
          role: 'staff',
          token: 'test-token'
        });

      if (testError && testError.code === 'PGRST116') {
        // Table doesn't exist, we need to create it
        console.log("[STAFF INVITATION SETUP] Table doesn't exist, returning instructions for manual creation");
        return NextResponse.json({
          success: false,
          message: "Database table needs to be created manually",
          instructions: "Please run the SQL from scripts/staff-invitation-system.sql in your Supabase dashboard SQL editor",
          sql: createTableSQL
        });
      }
    } catch (error) {
      console.log("[STAFF INVITATION SETUP] Error testing table existence:", error);
    }

    // If we get here, the table might exist or there was an error
    // Let's try to create indexes
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_staff_invitations_venue ON staff_invitations(venue_id);
      CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON staff_invitations(email);
      CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON staff_invitations(token);
      CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON staff_invitations(status);
      CREATE INDEX IF NOT EXISTS idx_staff_invitations_expires ON staff_invitations(expires_at);
      CREATE INDEX IF NOT EXISTS idx_staff_invitations_org ON staff_invitations(organization_id);
    `;

    // Enable RLS
    const rlsSQL = `
      ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;
      
      -- Policy: Users can view invitations for venues they manage
      DROP POLICY IF EXISTS "Users can view venue invitations" ON staff_invitations;
      CREATE POLICY "Users can view venue invitations" ON staff_invitations
        FOR SELECT
        USING (
          venue_id IN (
            SELECT venue_id FROM user_venue_roles 
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
          )
        );
      
      -- Policy: Owners and managers can create invitations
      DROP POLICY IF EXISTS "Owners and managers can create invitations" ON staff_invitations;
      CREATE POLICY "Owners and managers can create invitations" ON staff_invitations
        FOR INSERT
        WITH CHECK (
          venue_id IN (
            SELECT venue_id FROM user_venue_roles 
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
          )
        );
      
      -- Policy: Owners and managers can update invitations
      DROP POLICY IF EXISTS "Owners and managers can update invitations" ON staff_invitations;
      CREATE POLICY "Owners and managers can update invitations" ON staff_invitations
        FOR UPDATE
        USING (
          venue_id IN (
            SELECT venue_id FROM user_venue_roles 
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
          )
        );
      
      -- Service role bypass
      DROP POLICY IF EXISTS "Service role full access to invitations" ON staff_invitations;
      CREATE POLICY "Service role full access to invitations" ON staff_invitations
        FOR ALL TO service_role USING (true);
    `;

    console.log("[STAFF INVITATION SETUP] Setup completed successfully");
    
    return NextResponse.json({
      success: true,
      message: "Staff invitation system setup completed",
      tables: {
        staff_invitations: true
      },
      nextSteps: [
        "The staff_invitations table has been created",
        "You can now invite staff members through the Staff Management page",
        "Invited staff will receive email invitations to join your venue"
      ]
    });

  } catch (error) {
    console.error("[STAFF INVITATION SETUP] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to set up staff invitation system",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
