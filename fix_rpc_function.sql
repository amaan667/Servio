-- ============================================
-- FIXED get_access_context RPC FUNCTION
-- This function should return:
-- - user_id: 1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20
-- - venue_id: venue-1e02af4d
-- - role: owner
-- - tier: enterprise
-- ============================================

-- Drop and recreate the function
DROP FUNCTION IF EXISTS get_access_context(TEXT);

CREATE OR REPLACE FUNCTION get_access_context(p_venue_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_venue_id TEXT;
  v_role TEXT;
  v_tier TEXT;
  v_organization_id UUID;
  v_venue_ids TEXT[];
  v_permissions JSONB;
  v_result JSONB;
  v_is_owner BOOLEAN := FALSE;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- If no user, return null
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Normalize venue_id (ensure it has venue- prefix)
  IF p_venue_id IS NOT NULL THEN
    v_venue_id := CASE 
      WHEN p_venue_id LIKE 'venue-%' THEN p_venue_id
      ELSE 'venue-' || p_venue_id
    END;
  ELSE
    -- If no venue_id provided, return null
    RETURN NULL;
  END IF;
  
  -- First, check if user is owner of the venue
  SELECT 
    v.venue_id,
    v.organization_id,
    TRUE
  INTO v_venue_id, v_organization_id, v_is_owner
  FROM venues v
  WHERE v.venue_id = v_venue_id
    AND v.owner_user_id = v_user_id
  LIMIT 1;
  
  -- If user is owner, set role to 'owner'
  IF v_is_owner AND v_venue_id IS NOT NULL THEN
    v_role := 'owner';
  ELSE
    -- User is not owner, check user_venue_roles table
    SELECT 
      uvr.role,
      v.organization_id
    INTO v_role, v_organization_id
    FROM user_venue_roles uvr
    LEFT JOIN venues v ON v.venue_id = uvr.venue_id
    WHERE uvr.user_id = v_user_id
      AND uvr.venue_id = v_venue_id
    LIMIT 1;
    
    -- If no role found, user has no access
    IF v_role IS NULL THEN
      RETURN NULL;
    END IF;
    
    -- Ensure we have venue_id
    IF v_venue_id IS NULL THEN
      v_venue_id := p_venue_id;
      IF NOT v_venue_id LIKE 'venue-%' THEN
        v_venue_id := 'venue-' || v_venue_id;
      END IF;
    END IF;
  END IF;
  
  -- Get subscription tier from organization
  IF v_organization_id IS NOT NULL THEN
    SELECT 
      COALESCE(
        NULLIF(LOWER(TRIM(subscription_tier)), ''),
        'starter'
      )
    INTO v_tier
    FROM organizations
    WHERE id = v_organization_id
    LIMIT 1;
  END IF;
  
  -- Default tier if not found
  IF v_tier IS NULL OR v_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    v_tier := 'starter';
  END IF;
  
  -- Get all venue IDs user has access to (for multi-venue support)
  SELECT ARRAY_AGG(DISTINCT venue_id) INTO v_venue_ids
  FROM (
    SELECT venue_id FROM venues WHERE owner_user_id = v_user_id
    UNION
    SELECT venue_id FROM user_venue_roles WHERE user_id = v_user_id
  ) AS all_venues;
  
  -- Build permissions object (empty for now, can be extended)
  v_permissions := '{}'::JSONB;
  
  -- Build result JSONB - must match AccessContext interface
  v_result := jsonb_build_object(
    'user_id', v_user_id::TEXT,
    'venue_id', v_venue_id,
    'role', v_role,
    'tier', v_tier,
    'venue_ids', COALESCE(v_venue_ids, ARRAY[]::TEXT[]),
    'permissions', v_permissions
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return null to prevent breaking the app
    RAISE WARNING 'get_access_context error: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_access_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_access_context(TEXT) TO anon;

-- Test function (will only work when called with auth context)
-- SELECT * FROM get_access_context('venue-1e02af4d');
