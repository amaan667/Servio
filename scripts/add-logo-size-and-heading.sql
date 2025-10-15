-- Add logo size and custom heading fields to menu design settings
-- Run this in your Supabase SQL Editor

-- Add new columns for logo size, custom heading, and theme detection
ALTER TABLE menu_design_settings 
ADD COLUMN IF NOT EXISTS logo_size TEXT DEFAULT 'large',
ADD COLUMN IF NOT EXISTS custom_heading TEXT,
ADD COLUMN IF NOT EXISTS auto_theme_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS detected_primary_color TEXT,
ADD COLUMN IF NOT EXISTS detected_secondary_color TEXT;

-- Add comments for the new columns
COMMENT ON COLUMN menu_design_settings.logo_size IS 'Logo size: small, medium, large, extra-large';
COMMENT ON COLUMN menu_design_settings.custom_heading IS 'Custom heading text to display in menu preview';
COMMENT ON COLUMN menu_design_settings.auto_theme_enabled IS 'Whether to use auto-detected theme from logo';
COMMENT ON COLUMN menu_design_settings.detected_primary_color IS 'Primary color detected from logo';
COMMENT ON COLUMN menu_design_settings.detected_secondary_color IS 'Secondary color detected from logo';

-- Update existing records to have default values
UPDATE menu_design_settings 
SET logo_size = 'large',
    auto_theme_enabled = false
WHERE logo_size IS NULL;
