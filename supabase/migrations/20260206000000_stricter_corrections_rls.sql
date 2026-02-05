-- Stricter RLS for menu_item_corrections
-- Replaces permissive RLS (USING (true) WITH CHECK (true)) with proper venue-based access

-- Create venue_membership table for explicit venue access tracking
CREATE TABLE IF NOT EXISTS public.venue_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_membership_venue ON public.venue_membership (venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_membership_user ON public.venue_membership (user_id);

ALTER TABLE public.venue_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view venue membership" ON public.venue_membership;
DROP POLICY IF EXISTS "Owners can manage venue membership" ON public.venue_membership;

CREATE POLICY "Members can view venue membership"
  ON public.venue_membership
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_membership AS vm
      WHERE vm.venue_id = public.venue_membership.venue_id
      AND vm.user_id = auth.uid()
    )
  );

-- Only owners can modify membership
CREATE POLICY "Owners can manage venue membership"
  ON public.venue_membership
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_membership AS vm
      WHERE vm.venue_id = public.venue_membership.venue_id
      AND vm.user_id = auth.uid()
      AND vm.role = 'owner'
    )
  );

-- Update menu_item_corrections RLS to use venue_membership
DROP POLICY IF EXISTS "Users can manage corrections for venues they can access"
  ON public.menu_item_corrections;
DROP POLICY IF EXISTS "Venue members can manage corrections"
  ON public.menu_item_corrections;

CREATE POLICY "Venue members can manage corrections"
  ON public.menu_item_corrections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_membership
      WHERE venue_id = menu_item_corrections.venue_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venue_membership
      WHERE venue_id = menu_item_corrections.venue_id
      AND user_id = auth.uid()
    )
  );

-- Backfill venue_membership from existing venues (owners only).
-- Note: public.staff has no user_id column (only id, venue_id, name, role, active, created_at).
-- To add staff as venue members later, either add user_id to staff and backfill, or sync via app.
INSERT INTO public.venue_membership (venue_id, user_id, role)
SELECT venue_id, owner_user_id, 'owner'
FROM public.venues
WHERE owner_user_id IS NOT NULL
ON CONFLICT (venue_id, user_id) DO NOTHING;

-- feature_flag_overrides: create only if not exists (idempotent)
CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  venue_id TEXT,
  user_id UUID,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feature, venue_id),
  UNIQUE(feature, user_id),
  CONSTRAINT fk_venue_or_user CHECK (
    (venue_id IS NOT NULL AND user_id IS NULL) OR
    (venue_id IS NULL AND user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_feature ON public.feature_flag_overrides (feature);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_venue ON public.feature_flag_overrides (venue_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_user ON public.feature_flag_overrides (user_id);

ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feature flag overrides" ON public.feature_flag_overrides;
DROP POLICY IF EXISTS "Users can manage their own feature flag overrides" ON public.feature_flag_overrides;
DROP POLICY IF EXISTS "Venue owners can manage venue feature flag overrides" ON public.feature_flag_overrides;

CREATE POLICY "Anyone can read feature flag overrides"
  ON public.feature_flag_overrides
  FOR SELECT
  USING (true);

-- Only authenticated users can modify their own user-specific overrides
CREATE POLICY "Users can manage their own feature flag overrides"
  ON public.feature_flag_overrides
  FOR ALL
  USING (
    user_id = auth.uid()
  );

-- Venue owners/managers can manage venue-specific overrides
CREATE POLICY "Venue owners can manage venue feature flag overrides"
  ON public.feature_flag_overrides
  FOR ALL
  USING (
    venue_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.venue_membership
      WHERE venue_id = feature_flag_overrides.venue_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    venue_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.venue_membership
      WHERE venue_id = feature_flag_overrides.venue_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

COMMENT ON TABLE public.venue_membership IS 'Explicit venue membership for access control';
COMMENT ON TABLE public.feature_flag_overrides IS 'Feature flag overrides for venues and users';
