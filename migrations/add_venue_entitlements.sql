-- Migration: Add comprehensive tier entitlements system
-- Adds venue.tier column and venue_addons table for add-on management

-- Add tier column to venues table
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter' CHECK (tier IN ('starter', 'pro', 'enterprise'));

-- Create venue_addons table for managing add-ons (KDS, API light, etc.)
CREATE TABLE IF NOT EXISTS venue_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL CHECK (addon_key IN ('kds_starter', 'api_pro_light')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  stripe_subscription_item_id TEXT UNIQUE,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one active addon per venue per addon_key
  UNIQUE(venue_id, addon_key, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_venue_addons_venue_id ON venue_addons(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_addons_addon_key ON venue_addons(addon_key);
CREATE INDEX IF NOT EXISTS idx_venue_addons_status ON venue_addons(status);
CREATE INDEX IF NOT EXISTS idx_venue_addons_stripe_item ON venue_addons(stripe_subscription_item_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_venue_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_venue_addons_updated_at
  BEFORE UPDATE ON venue_addons
  FOR EACH ROW EXECUTE FUNCTION update_venue_addons_updated_at();

-- Create RPC function to get venue entitlements
CREATE OR REPLACE FUNCTION get_venue_entitlements(p_venue_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_addons JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  -- Get venue tier
  SELECT COALESCE(tier, 'starter') INTO v_tier
  FROM venues
  WHERE venue_id = p_venue_id;

  -- Get active add-ons
  SELECT jsonb_agg(
    jsonb_build_object(
      'addon_key', addon_key,
      'status', status,
      'stripe_subscription_item_id', stripe_subscription_item_id,
      'stripe_price_id', stripe_price_id
    )
  ) INTO v_addons
  FROM venue_addons
  WHERE venue_id = p_venue_id AND status = 'active';

  -- Build entitlements based on tier and add-ons
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
      WHEN v_tier = 'starter' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_addons) AS addon
        WHERE addon->>'addon_key' = 'kds_starter'
      ) THEN jsonb_build_object('enabled', true, 'mode', 'single')
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
      WHEN v_tier = 'pro' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_addons) AS addon
        WHERE addon->>'addon_key' = 'api_pro_light'
      ) THEN jsonb_build_object('enabled', true, 'level', 'light')
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_venue_entitlements(TEXT) TO authenticated;

-- Backfill existing venues with tier from organizations
UPDATE venues
SET tier = COALESCE((
  SELECT o.subscription_tier
  FROM organizations o
  WHERE o.owner_user_id = venues.owner_user_id
  LIMIT 1
), 'starter')
WHERE tier IS NULL;

-- Add comments
COMMENT ON TABLE venue_addons IS 'Stores add-on subscriptions for venues (KDS starter, API pro light)';
COMMENT ON COLUMN venues.tier IS 'Current subscription tier for the venue (starter|pro|enterprise)';
COMMENT ON FUNCTION get_venue_entitlements(TEXT) IS 'Returns comprehensive entitlements for a venue based on tier and active add-ons';