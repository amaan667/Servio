-- Fix get_access_context: venues.subscription_tier may not exist in some schemas.
-- Tier comes from organizations; default to 'starter' when org has no tier.
-- Safe to run: replaces the RPC.

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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Look up venue (owner_user_id, organization_id only - subscription_tier may not exist)
  SELECT owner_user_id, organization_id
  INTO v_owner_user_id, v_org_id
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

  -- Tier: organization only (authoritative). Default 'starter' if no org or no tier.
  v_tier := NULL;
  IF v_org_id IS NOT NULL THEN
    SELECT subscription_tier INTO v_tier
    FROM public.organizations
    WHERE id = v_org_id;
  END IF;

  v_tier := lower(trim(COALESCE(v_tier, '')));

  IF v_tier = '' OR v_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    IF v_tier LIKE '%enterprise%' THEN
      v_tier := 'enterprise';
    ELSIF v_tier LIKE '%pro%' THEN
      v_tier := 'pro';
    ELSIF v_tier LIKE '%starter%' THEN
      v_tier := 'starter';
    ELSE
      v_tier := 'starter';
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
