-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_invitation_by_token(TEXT);
DROP FUNCTION IF EXISTS accept_invitation(TEXT, UUID);

-- Create function to get invitation by token
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  organization_id UUID,
  invited_by UUID,
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
    si.invited_by,
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
    v.venue_name,
    o.name as organization_name,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.email
    ) as invited_by_name
  FROM staff_invitations si
  LEFT JOIN venues v ON si.venue_id = v.venue_id
  LEFT JOIN organizations o ON si.organization_id = o.id
  LEFT JOIN auth.users au ON si.invited_by = au.id
  WHERE si.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_invitation_id UUID;
  v_venue_id TEXT;
  v_role TEXT;
  v_permissions JSONB;
BEGIN
  -- Get invitation details
  SELECT id, venue_id, role, permissions
  INTO v_invitation_id, v_venue_id, v_role, v_permissions
  FROM staff_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();
  
  -- If no invitation found, return false
  IF v_invitation_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update invitation status
  UPDATE staff_invitations
  SET 
    status = 'accepted',
    user_id = p_user_id,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = v_invitation_id;
  
  -- Add user to venue with role
  INSERT INTO user_venue_roles (user_id, venue_id, role, permissions)
  VALUES (p_user_id, v_venue_id, v_role, v_permissions)
  ON CONFLICT (user_id, venue_id) DO UPDATE
  SET 
    role = v_role,
    permissions = v_permissions,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_invitation_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, UUID) TO anon;

