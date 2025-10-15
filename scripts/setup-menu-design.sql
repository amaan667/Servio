-- Setup script for Menu Design Settings
-- Run this in your Supabase SQL Editor

-- 1. Create the menu_design_settings table
CREATE TABLE IF NOT EXISTS menu_design_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  
  -- Branding
  venue_name TEXT,
  logo_url TEXT,
  
  -- Theme & Colors
  primary_color TEXT DEFAULT '#8b5cf6',
  secondary_color TEXT DEFAULT '#f3f4f6',
  
  -- Layout & Display
  font_family TEXT DEFAULT 'inter',
  font_size TEXT DEFAULT 'medium',
  show_descriptions BOOLEAN DEFAULT true,
  show_prices BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(venue_id)
);

-- 2. Add index for performance
CREATE INDEX IF NOT EXISTS idx_menu_design_settings_venue ON menu_design_settings(venue_id);

-- 3. Add comment
COMMENT ON TABLE menu_design_settings IS 'Stores custom design settings for menu display and branding';

-- 4. Create storage bucket for venue assets (logos, etc.)
-- Note: You'll need to create this bucket in the Supabase Storage section manually
-- Go to Storage > Create Bucket > Name: venue-assets > Public: Yes

-- 5. Set up RLS (Row Level Security) policies
ALTER TABLE menu_design_settings ENABLE ROW LEVEL SECURITY;

-- Simple policy that allows authenticated users to manage design settings
-- This is more permissive but avoids column name issues
CREATE POLICY "Authenticated users can manage design settings" ON menu_design_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- 6. Grant necessary permissions
GRANT ALL ON menu_design_settings TO authenticated;
GRANT ALL ON menu_design_settings TO service_role;
