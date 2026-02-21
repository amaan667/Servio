-- Migration: Fix venue access RLS and create get_access_context RPC
--
-- Problems fixed:
-- 1. user_has_venue_access() could error if venue_membership was out of sync.
--    Now checks venues.owner_user_id and user_venue_roles FIRST (most reliable).
-- 2. get_access_context RPC is created/replaced to return role + tier for
--    the calling user.  It is SECURITY DEFINER so it bypasses all RLS.
-- 3. venue_membership is synced from venues + user_venue_roles.
-- 4. organizations table is handled safely (may not exist for some setups).

-- ============================================================
-- 0. Ensure venue_membership table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'viewer', 'server', 'kitchen', 'cashier')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_membership_venue ON public.venue_membership (venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_membership_user ON public.venue_membership (user_id);

-- ============================================================
-- 1. Update user_has_venue_access — check ALL access sources
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_venue_access(p_venue_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check venue ownership (fastest, most reliable)
  IF EXISTS (
    SELECT 1 FROM public.venues
    WHERE venue_id = p_venue_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check user_venue_roles (staff/manager assignments)
  IF EXISTS (
    SELECT 1 FROM public.user_venue_roles
    WHERE venue_id = p_venue_id AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check venue_membership (legacy/synced table)
  IF EXISTS (
    SELECT 1 FROM public.venue_membership
    WHERE venue_id = p_venue_id AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_venue_access(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_venue_access(TEXT) TO service_role;

-- ============================================================
-- 2. Sync venue_membership from venues (owners) + user_venue_roles (staff)
-- ============================================================
INSERT INTO public.venue_membership (venue_id, user_id, role)
SELECT venue_id, owner_user_id, 'owner'
FROM public.venues
WHERE owner_user_id IS NOT NULL
ON CONFLICT (venue_id, user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.venue_membership (venue_id, user_id, role)
SELECT venue_id, user_id, role
FROM public.user_venue_roles
WHERE user_id IS NOT NULL
ON CONFLICT (venue_id, user_id) DO NOTHING;

-- ============================================================
-- 3. Create get_access_context RPC
--    Returns { user_id, venue_id, role, tier, venue_ids, permissions }
--    SECURITY DEFINER — bypasses RLS, only needs auth.uid() from JWT.
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
      -- Also check venue_membership as fallback
      SELECT role INTO v_role
      FROM public.venue_membership
      WHERE user_id = v_user_id AND venue_id = p_venue_id;
    END IF;

    IF v_role IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Determine tier: organization first, then venue
  BEGIN
    IF v_org_id IS NOT NULL THEN
      SELECT subscription_tier INTO v_tier
      FROM public.organizations
      WHERE id = v_org_id;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    v_tier := NULL;
  END;

  IF v_tier IS NULL OR v_tier = '' THEN
    v_tier := COALESCE(v_venue_tier, 'starter');
  END IF;

  v_tier := lower(trim(v_tier));

  IF v_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    v_tier := 'starter';
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

-- ============================================================
-- 4. Ensure RLS policies on venue_membership allow service_role
-- ============================================================
ALTER TABLE public.venue_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_membership_service_role" ON public.venue_membership;
CREATE POLICY "venue_membership_service_role"
  ON public.venue_membership FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Ensure venues RLS policy uses the updated function
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues') THEN
    DROP POLICY IF EXISTS "venue_select_own" ON public.venues;
    CREATE POLICY "venue_select_own" ON public.venues FOR SELECT TO authenticated
      USING (owner_user_id = auth.uid() OR public.user_has_venue_access(venue_id::text));
  END IF;
END $$;
