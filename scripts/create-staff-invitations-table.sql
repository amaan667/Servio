-- Create staff_invitations table
-- Run this in your Supabase dashboard SQL editor

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
