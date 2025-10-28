-- Fix RLS policies for menu_design_settings table
-- Ensures owners can insert/update their venue's design settings

-- Enable RLS if not already enabled
ALTER TABLE menu_design_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view their venue design settings" ON menu_design_settings;
DROP POLICY IF EXISTS "Owners can insert their venue design settings" ON menu_design_settings;
DROP POLICY IF EXISTS "Owners can update their venue design settings" ON menu_design_settings;
DROP POLICY IF EXISTS "Owners can delete their venue design settings" ON menu_design_settings;

-- Create comprehensive RLS policies

-- SELECT: Users can view design settings for their venues
CREATE POLICY "Users can view their venue design settings"
ON menu_design_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM venues
    WHERE venues.venue_id = menu_design_settings.venue_id
    AND venues.owner_user_id = auth.uid()
  )
);

-- INSERT: Owners can insert design settings for their venues
CREATE POLICY "Owners can insert their venue design settings"
ON menu_design_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM venues
    WHERE venues.venue_id = menu_design_settings.venue_id
    AND venues.owner_user_id = auth.uid()
  )
);

-- UPDATE: Owners can update design settings for their venues
CREATE POLICY "Owners can update their venue design settings"
ON menu_design_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM venues
    WHERE venues.venue_id = menu_design_settings.venue_id
    AND venues.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM venues
    WHERE venues.venue_id = menu_design_settings.venue_id
    AND venues.owner_user_id = auth.uid()
  )
);

-- DELETE: Owners can delete design settings for their venues
CREATE POLICY "Owners can delete their venue design settings"
ON menu_design_settings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM venues
    WHERE venues.venue_id = menu_design_settings.venue_id
    AND venues.owner_user_id = auth.uid()
  )
);

