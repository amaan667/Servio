-- PATCH: Security hardening for entitlements system
-- Critical security fixes for production safety

-- 1. FIX ADD-ON UNIQUENESS MODEL
-- Remove the problematic unique constraint that prevents storing history
-- Drop the constraint (which also drops the underlying index)
ALTER TABLE venue_addons DROP CONSTRAINT IF EXISTS venue_addons_venue_id_addon_key_status_key;

-- Create proper partial unique index: only one ACTIVE addon per venue per addon_key
-- Allow unlimited cancelled/expired history rows
CREATE UNIQUE INDEX IF NOT EXISTS venue_addons_one_active
ON venue_addons (venue_id, addon_key)
WHERE status = 'active';

-- 2. SECURE THE RPC FUNCTION WITH USER ACCESS VERIFICATION
CREATE OR REPLACE FUNCTION get_venue_entitlements(p_venue_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_venue_exists BOOLEAN := FALSE;
  v_user_has_access BOOLEAN := FALSE;
  v_tier TEXT;
  v_addons JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  -- CRITICAL: Get authenticated user ID from JWT
  v_user_id := auth.uid();

  -- SECURITY: Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden: authentication required';
  END IF;

  -- SECURITY: Verify venue exists
  SELECT EXISTS(
    SELECT 1 FROM venues WHERE venue_id = p_venue_id
  ) INTO v_venue_exists;

  IF NOT v_venue_exists THEN
    RAISE EXCEPTION 'forbidden: venue not found';
  END IF;

  -- SECURITY: Verify user has access to this venue
  -- Use the same access control logic as get_access_context
  SELECT EXISTS(
    -- Check if user owns the venue
    SELECT 1 FROM venues
    WHERE venue_id = p_venue_id AND owner_user_id = v_user_id

    UNION ALL

    -- Check if user has staff role for the venue
    SELECT 1 FROM user_venue_roles
    WHERE venue_id = p_venue_id AND user_id = v_user_id
  ) INTO v_user_has_access;

  IF NOT v_user_has_access THEN
    RAISE EXCEPTION 'forbidden: access denied to venue %', p_venue_id;
  END IF;

  -- Get venue tier (no defaulting to starter - error loudly if missing)
  SELECT tier INTO v_tier
  FROM venues
  WHERE venue_id = p_venue_id;

  -- SAFETY: Ensure tier is valid
  IF v_tier IS NULL OR v_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid tier for venue %: %', p_venue_id, v_tier;
  END IF;

  -- NULL-SAFE: Get active add-ons (jsonb_agg returns [] not NULL)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'addon_key', addon_key,
        'status', status,
        'stripe_subscription_item_id', stripe_subscription_item_id,
        'stripe_price_id', stripe_price_id
      )
    ),
    '[]'::jsonb
  ) INTO v_addons
  FROM venue_addons
  WHERE venue_id = p_venue_id AND status = 'active';

  -- Build entitlements based on tier and add-ons
  -- NULL-SAFE: Handle potential NULL values safely
  v_result := jsonb_build_object(
    'tier', v_tier,
    'maxStaff', CASE
      WHEN v_tier = 'starter' THEN 5
      WHEN v_tier = 'pro' THEN 15
      WHEN v_tier = 'enterprise' THEN NULL
      ELSE 5
    END,
    'maxTables', CASE
      WHEN v_tier = 'starter' THEN 25
      WHEN v_tier = 'pro' THEN 100
      WHEN v_tier = 'enterprise' THEN NULL
      ELSE 25
    END,
    'maxLocations', CASE
      WHEN v_tier = 'starter' THEN 1
      WHEN v_tier = 'pro' THEN 3
      WHEN v_tier = 'enterprise' THEN NULL
      ELSE 1
    END,
    'kds', CASE
      -- NULL-SAFE: Check if addons array contains kds_starter and it's active
      WHEN v_tier = 'starter' AND v_addons @> '[{"addon_key": "kds_starter"}]'::jsonb
        THEN jsonb_build_object('enabled', true, 'mode', 'single')
      WHEN v_tier IN ('pro', 'enterprise') THEN jsonb_build_object('enabled', true, 'mode',
        CASE WHEN v_tier = 'pro' THEN 'multi' ELSE 'enterprise' END
      )
      ELSE jsonb_build_object('enabled', false, 'mode', NULL)
    END,
    'analytics', jsonb_build_object(
      'level', CASE
        WHEN v_tier = 'starter' THEN 'basic'
        WHEN v_tier IN ('pro', 'enterprise') THEN 'advanced'
        ELSE 'basic'
      END,
      'csvExport', v_tier IN ('pro', 'enterprise'),
      'financeExport', v_tier = 'enterprise'
    ),
    'branding', jsonb_build_object(
      'level', CASE
        WHEN v_tier = 'starter' THEN 'basic'
        WHEN v_tier IN ('pro', 'enterprise') THEN 'full'
        ELSE 'basic'
      END,
      'customDomain', v_tier = 'enterprise'
    ),
    'api', CASE
      WHEN v_tier = 'enterprise' THEN jsonb_build_object('enabled', true, 'level', 'full')
      -- NULL-SAFE: Check if addons array contains api_pro_light
      WHEN v_tier = 'pro' AND v_addons @> '[{"addon_key": "api_pro_light"}]'::jsonb
        THEN jsonb_build_object('enabled', true, 'level', 'light')
      ELSE jsonb_build_object('enabled', false, 'level', NULL)
    END,
    'support', jsonb_build_object(
      'level', CASE
        WHEN v_tier = 'starter' THEN 'email'
        WHEN v_tier = 'pro' THEN 'priority'
        WHEN v_tier = 'enterprise' THEN 'sla'
        ELSE 'email'
      END
    )
  );

  RETURN v_result;
END;
$$;

-- 3. ADD DOWNGRADE SAFETY FUNCTION
CREATE OR REPLACE FUNCTION validate_tier_downgrade(
  p_organization_id UUID,
  p_new_tier TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_tier TEXT;
  v_venue_count INTEGER;
BEGIN
  -- Get current tier
  SELECT subscription_tier INTO v_current_tier
  FROM organizations
  WHERE id = p_organization_id;

  IF v_current_tier = p_new_tier THEN
    RETURN TRUE; -- No change
  END IF;

  -- Count venues for this organization
  SELECT COUNT(*) INTO v_venue_count
  FROM venues
  WHERE organization_id = p_organization_id;

  -- Validate downgrade rules
  CASE
    -- Pro → Starter: max 1 venue
    WHEN v_current_tier = 'pro' AND p_new_tier = 'starter' THEN
      IF v_venue_count > 1 THEN
        RETURN FALSE;
      END IF;

    -- Enterprise → Pro: max 3 venues
    WHEN v_current_tier = 'enterprise' AND p_new_tier = 'pro' THEN
      IF v_venue_count > 3 THEN
        RETURN FALSE;
      END IF;

    -- Enterprise → Starter: max 1 venue
    WHEN v_current_tier = 'enterprise' AND p_new_tier = 'starter' THEN
      IF v_venue_count > 1 THEN
        RETURN FALSE;
      END IF;

    -- Upgrades are always allowed
    WHEN p_new_tier = 'pro' AND v_current_tier = 'starter' THEN
      RETURN TRUE;
    WHEN p_new_tier = 'enterprise' THEN
      RETURN TRUE;

    ELSE
      -- Same tier or invalid transition
      RETURN TRUE;
  END CASE;

  RETURN TRUE;
END;
$$;

-- Grant execute permission for the validation function
GRANT EXECUTE ON FUNCTION validate_tier_downgrade(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION validate_tier_downgrade(UUID, TEXT) IS 'Validates if a tier downgrade is allowed based on current venue count';
COMMENT ON INDEX venue_addons_one_active IS 'Ensures only one active add-on per venue per addon_key';