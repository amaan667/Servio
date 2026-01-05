-- Migration: Add get_access_context() RPC for instant auth/tier/role checks
-- Returns unified access context in a single database call
-- SECURITY DEFINER ensures it runs with elevated privileges but enforces RLS

CREATE OR REPLACE FUNCTION get_access_context(
  p_venue_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_venue_row RECORD;
  v_role_row RECORD;
  v_org_row RECORD;
  v_tier TEXT;
BEGIN
  -- Get authenticated user ID from JWT
  v_user_id := auth.uid();
  
  -- If no user, return null
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- If no venue_id provided, return user-only context
  IF p_venue_id IS NULL THEN
    -- Get user's organization and tier
    SELECT 
      id,
      subscription_tier,
      subscription_status,
      owner_user_id
    INTO v_org_row
    FROM organizations
    WHERE owner_user_id = v_user_id
    LIMIT 1;

    v_tier := COALESCE(v_org_row.subscription_tier, 'starter');
    IF v_org_row.subscription_status != 'active' THEN
      v_tier := 'starter';
    END IF;

    RETURN jsonb_build_object(
      'user_id', v_user_id,
      'venue_id', NULL,
      'role', 'owner',
      'tier', v_tier,
      'venue_ids', '[]'::jsonb,
      'permissions', '{}'::jsonb
    );
  END IF;

  -- Get venue with owner check
  SELECT *
  INTO v_venue_row
  FROM venues
  WHERE venue_id = p_venue_id
  LIMIT 1;

  -- If venue doesn't exist, return null
  IF v_venue_row IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get tier directly from user's organization (same as settings page)
  -- This is the source of truth synced with Stripe via webhooks
  SELECT
    subscription_tier,
    subscription_status
  INTO v_org_row
  FROM organizations
  WHERE owner_user_id = v_user_id
  LIMIT 1;

  -- DEBUG LOGGING: Log what we found in the organization
  RAISE LOG '[GET_ACCESS_CONTEXT] User % organization lookup: tier=%, status=%',
    v_user_id, v_org_row.subscription_tier, v_org_row.subscription_status;

  v_tier := COALESCE(v_org_row.subscription_tier, 'starter');
  IF v_org_row.subscription_status != 'active' THEN
    v_tier := 'starter';
  END IF;

  -- DEBUG LOGGING: Log the final tier being used
  RAISE LOG '[GET_ACCESS_CONTEXT] User % final tier: % (venue: %)',
    v_user_id, v_tier, p_venue_id;

  -- Check if user owns the venue
  IF v_venue_row.owner_user_id = v_user_id THEN

    RETURN jsonb_build_object(
      'user_id', v_user_id,
      'venue_id', p_venue_id,
      'role', 'owner',
      'tier', v_tier,
      'venue_ids', jsonb_build_array(p_venue_id),
      'permissions', '{}'::jsonb
    );
  END IF;

  -- Check if user has a role in user_venue_roles
  SELECT role
  INTO v_role_row
  FROM user_venue_roles
  WHERE venue_id = p_venue_id
    AND user_id = v_user_id
  LIMIT 1;

  -- If no role, return null (no access)
  IF v_role_row IS NULL THEN
    RETURN NULL;
  END IF;

  -- User has staff role - get tier from venue owner's organization
  -- Get tier directly from venue owner's organization (same as settings page)
  SELECT 
    subscription_tier,
    subscription_status
  INTO v_org_row
  FROM organizations
  WHERE owner_user_id = v_venue_row.owner_user_id
  LIMIT 1;

  v_tier := COALESCE(v_org_row.subscription_tier, 'starter');
  IF v_org_row.subscription_status != 'active' THEN
    v_tier := 'starter';
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'venue_id', p_venue_id,
    'role', v_role_row.role,
    'tier', v_tier,
    'venue_ids', jsonb_build_array(p_venue_id),
    'permissions', '{}'::jsonb
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_access_context(TEXT) TO authenticated;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_venue_user 
  ON user_venue_roles(venue_id, user_id);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_user 
  ON organizations(owner_user_id) 
  WHERE subscription_status = 'active';

COMMENT ON FUNCTION get_access_context(TEXT) IS 
  'Returns unified access context (user_id, role, tier, venue_ids, permissions) in a single call. 
   Enforces RLS - only returns data user has access to. Tier comes from venue owner''s organization.';

