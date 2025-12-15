-- Migration: Create kds_station_categories table for category-based station assignment
-- This allows assigning KDS stations to menu categories instead of individual items
-- Much less manual work - one assignment per category instead of per item

-- Create kds_station_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS kds_station_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
  menu_category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, menu_category)
);

-- Add comment explaining the table
COMMENT ON TABLE kds_station_categories IS 'Maps menu categories to KDS stations. Items in a category will automatically route to the assigned station.';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_kds_station_categories_venue_category ON kds_station_categories(venue_id, menu_category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kds_station_categories_station ON kds_station_categories(station_id);

-- Enable RLS
ALTER TABLE kds_station_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view/manage station categories for venues they have access to
CREATE POLICY "users_manage_venue_station_categories" ON kds_station_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = kds_station_categories.venue_id
      AND (
        venues.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_venue_roles
          WHERE user_venue_roles.venue_id = venues.venue_id
          AND user_venue_roles.user_id = auth.uid()
          AND user_venue_roles.role IN ('owner', 'manager', 'staff', 'kitchen')
        )
      )
    )
  );
