-- Add logo_size_numeric column to menu_design_settings table
-- This allows precise logo sizing (80-400px) instead of text options

ALTER TABLE menu_design_settings
ADD COLUMN IF NOT EXISTS logo_size_numeric INTEGER DEFAULT 200;

-- Add comment for documentation
COMMENT ON COLUMN menu_design_settings.logo_size_numeric IS 'Logo size in pixels (80-400). Replaces legacy logo_size text field.';

