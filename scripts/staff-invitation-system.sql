-- Staff Invitation System Schema
-- Enables invitation-based staff management with email invitations and role assignment

-- ============================================================================
-- Staff Invitations Table
-- ============================================================================

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
  token TEXT NOT NULL UNIQUE, -- Secure token for invitation link
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- User account created from invitation
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  UNIQUE(venue_id, email, status) -- Only one pending invitation per email per venue
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_invitations_venue ON staff_invitations(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON staff_invitations(email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON staff_invitations(status);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_expires ON staff_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_org ON staff_invitations(organization_id);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set token on insert
CREATE OR REPLACE FUNCTION set_invitation_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL OR NEW.token = '' THEN
    NEW.token := generate_invitation_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate token
DROP TRIGGER IF EXISTS trg_set_invitation_token ON staff_invitations;
CREATE TRIGGER trg_set_invitation_token
  BEFORE INSERT ON staff_invitations
  FOR EACH ROW
  EXECUTE FUNCTION set_invitation_token();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invitation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trg_update_invitation_updated_at ON staff_invitations;
CREATE TRIGGER trg_update_invitation_updated_at
  BEFORE UPDATE ON staff_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_invitation_updated_at();

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE staff_invitations 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get invitation by token
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  organization_id UUID,
  email TEXT,
  role TEXT,
  permissions JSONB,
  status TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  venue_name TEXT,
  organization_name TEXT,
  invited_by_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.venue_id,
    si.organization_id,
    si.email,
    si.role,
    si.permissions,
    si.status,
    si.expires_at,
    si.created_at,
    v.venue_name,
    o.name as organization_name,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email) as invited_by_name
  FROM staff_invitations si
  JOIN venues v ON v.venue_id = si.venue_id
  LEFT JOIN organizations o ON o.id = si.organization_id
  LEFT JOIN auth.users au ON au.id = si.invited_by
  WHERE si.token = p_token;
END;
$$ LANGUAGE plpgsql;

-- Function to accept invitation and create user role
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM staff_invitations
  WHERE token = p_token 
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update invitation status
  UPDATE staff_invitations
  SET 
    status = 'accepted',
    user_id = p_user_id,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = invitation_record.id;
  
  -- Create user venue role
  INSERT INTO user_venue_roles (user_id, venue_id, organization_id, role, permissions)
  VALUES (
    p_user_id,
    invitation_record.venue_id,
    invitation_record.organization_id,
    invitation_record.role,
    invitation_record.permissions
  )
  ON CONFLICT (user_id, venue_id) 
  DO UPDATE SET
    role = invitation_record.role,
    permissions = invitation_record.permissions,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
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

-- Policy: Anyone can view invitation by token (for acceptance flow)
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON staff_invitations;
CREATE POLICY "Anyone can view invitation by token" ON staff_invitations
  FOR SELECT
  USING (true); -- This will be restricted by application logic

-- Service role bypass
DROP POLICY IF EXISTS "Service role full access to invitations" ON staff_invitations;
CREATE POLICY "Service role full access to invitations" ON staff_invitations
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================

-- Uncomment to add sample invitations for testing
/*
INSERT INTO staff_invitations (venue_id, invited_by, email, role, expires_at)
SELECT 
  v.venue_id,
  v.owner_user_id,
  'test@example.com',
  'staff',
  NOW() + INTERVAL '7 days'
FROM venues v
LIMIT 1;
*/

-- ============================================================================
-- Cleanup and Maintenance
-- ============================================================================

-- Create a function to clean up expired invitations (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Delete invitations that expired more than 30 days ago
  DELETE FROM staff_invitations
  WHERE status = 'expired' 
    AND expires_at < (NOW() - INTERVAL '30 days');
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for Easy Querying
-- ============================================================================

-- View for active invitations with venue and organization details
CREATE OR REPLACE VIEW active_invitations AS
SELECT 
  si.*,
  v.venue_name,
  o.name as organization_name,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as invited_by_name
FROM staff_invitations si
JOIN venues v ON v.venue_id = si.venue_id
LEFT JOIN organizations o ON o.id = si.organization_id
LEFT JOIN auth.users au ON au.id = si.invited_by
WHERE si.status = 'pending' 
  AND si.expires_at > NOW();

-- View for invitation statistics
CREATE OR REPLACE VIEW invitation_stats AS
SELECT 
  venue_id,
  COUNT(*) as total_invitations,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_invitations,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_invitations,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_invitations,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_invitations
FROM staff_invitations
GROUP BY venue_id;
