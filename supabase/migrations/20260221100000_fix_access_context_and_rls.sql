-- Migration: Fix venue access RLS and create get_access_context RPC
--
-- Problems fixed:
-- 1. user_has_venue_access() only checked venue_membership (owners only).
--    Staff in user_venue_roles were blocked by RLS.
-- 2. get_access_context RPC did not exist — every call returned an error.
-- 3. venue_membership was not synced from user_venue_roles.

-- ============================================================
-- 1. Update user_has_venue_access to also check user_venue_roles
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_venue_access(p_venue_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.venues
    WHERE venue_id = p_venue_id AND owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.user_venue_roles
    WHERE venue_id = p_venue_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.venue_membership
    WHERE venue_id = p_venue_id AND user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_venue_access(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_venue_access(TEXT) TO service_role;

-- ============================================================
-- 2. Sync venue_membership from user_venue_roles (backfill staff)
-- ============================================================
INSERT INTO public.venue_membership (venue_id, user_id, role)
SELECT venue_id, user_id, role
FROM public.user_venue_roles
WHERE user_id IS NOT NULL
ON CONFLICT (venue_id, user_id) DO NOTHING;

-- ============================================================
-- 3. Create get_access_context RPC
--    Returns { user_id, venue_id, role, tier, venue_ids, permissions }
--    Used by middleware, unified handler, and access context helpers.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_access_context(TEXT);

CREATE OR REPLACE FUNCTION public.get_access_context(p_venue_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_tier TEXT;
  v_owner_user_id UUID;
  v_org_id UUID;
  v_venue_tier TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Look up venue
  SELECT owner_user_id, organization_id, subscription_tier
  INTO v_owner_user_id, v_org_id, v_venue_tier
  FROM public.venues
  WHERE venue_id = p_venue_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Determine role: owner check then user_venue_roles
  IF v_owner_user_id = v_user_id THEN
    v_role := 'owner';
  ELSE
    SELECT role INTO v_role
    FROM public.user_venue_roles
    WHERE user_id = v_user_id AND venue_id = p_venue_id;

    IF v_role IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Determine tier: organization first, then venue
  IF v_org_id IS NOT NULL THEN
    SELECT subscription_tier INTO v_tier
    FROM public.organizations
    WHERE id = v_org_id;
  END IF;

  -- Use org tier first, then venue tier. Never overwrite pro/enterprise with starter.
  IF v_tier IS NULL OR v_tier = '' THEN
    v_tier := v_venue_tier;
  END IF;

  v_tier := lower(trim(COALESCE(v_tier, '')));

  -- Only default to starter when we have no tier. Accept pro/enterprise from DB.
  IF v_tier = '' OR v_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    IF v_tier LIKE '%enterprise%' THEN
      v_tier := 'enterprise';
    ELSIF v_tier LIKE '%pro%' THEN
      v_tier := 'pro';
    ELSIF v_tier LIKE '%starter%' THEN
      v_tier := 'starter';
    ELSE
      v_tier := 'starter';  -- Only when DB has no tier (new venue)
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user_id::TEXT,
    'venue_id', p_venue_id,
    'role', v_role,
    'tier', v_tier,
    'venue_ids', to_jsonb(ARRAY[p_venue_id]),
    'permissions', '{}'::JSONB
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_access_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_context(TEXT) TO service_role;

COMMENT ON FUNCTION public.get_access_context IS
  'Returns auth context (role, tier, venue_ids) for the current user and given venue. '
  'Used by middleware, API handlers, and access context helpers.';
