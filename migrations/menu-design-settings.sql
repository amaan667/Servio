-- Menu Design Settings Schema
-- Stores custom design settings for menu display

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

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_menu_design_settings_venue ON menu_design_settings(venue_id);

-- Add comment
COMMENT ON TABLE menu_design_settings IS 'Stores custom design settings for menu display and branding';
