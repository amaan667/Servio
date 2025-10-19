// One-time migration endpoint to create the staff_invitations table
// This can be called once to set up the database

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSafe } from "@/utils/getUserSafe";
import { apiLogger, logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/migrate-staff-invitations');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.debug('[STAFF MIGRATION] Starting staff invitation system migration...');
    
    const supabase = await createClient();

    // Check if table already exists
    try {
      await supabase.from('staff_invitations').select('id').limit(1);
      return NextResponse.json({
        success: true,
        message: 'Staff invitation system already exists',
        tables: {
          staff_invitations: true
        }
      });
    } catch (tableError: any) {
      if (tableError.code !== 'PGRST116' && !tableError.message?.includes('relation "staff_invitations" does not exist')) {
        logger.error('[STAFF MIGRATION] Unexpected error checking table:', { error: tableError instanceof Error ? tableError.message : 'Unknown error' });
        return NextResponse.json({ 
          error: 'Database error. Please try again.' 
        }, { status: 500 });
      }
    }

    // Table doesn't exist, we need to create it
    // Since we can't execute raw SQL through the Supabase client in this environment,
    // we'll return the SQL that needs to be run manually
    logger.debug('[STAFF MIGRATION] Table does not exist, returning SQL for manual execution');
    
    const migrationSQL = `
-- Staff Invitation System Migration
-- Run this SQL in your Supabase dashboard SQL editor

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_invitations_venue ON staff_invitations(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON staff_invitations(email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON staff_invitations(status);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_expires ON staff_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_org ON staff_invitations(organization_id);

-- Enable RLS
ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view venue invitations" ON staff_invitations;
CREATE POLICY "Users can view venue invitations" ON staff_invitations
  FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "Owners and managers can create invitations" ON staff_invitations;
CREATE POLICY "Owners and managers can create invitations" ON staff_invitations
  FOR INSERT
  WITH CHECK (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "Owners and managers can update invitations" ON staff_invitations;
CREATE POLICY "Owners and managers can update invitations" ON staff_invitations
  FOR UPDATE
  USING (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "Service role full access to invitations" ON staff_invitations;
CREATE POLICY "Service role full access to invitations" ON staff_invitations
  FOR ALL TO service_role USING (true);
`;

    return NextResponse.json({
      success: false,
      message: 'Database migration required',
      instructions: 'Please run the following SQL in your Supabase dashboard SQL editor',
      sql: migrationSQL,
      nextSteps: [
        '1. Go to your Supabase dashboard',
        '2. Navigate to the SQL Editor',
        '3. Copy and paste the SQL above',
        '4. Click "Run" to execute the migration',
        '5. Try creating an invitation again'
      ]
    });

  } catch (error) {
    logger.error('[STAFF MIGRATION] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: 'Failed to check migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
