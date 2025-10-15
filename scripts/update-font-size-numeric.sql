-- Update font_size column to support numeric values
-- Run this in your Supabase SQL Editor

-- Add a new column for numeric font size
ALTER TABLE menu_design_settings 
ADD COLUMN IF NOT EXISTS font_size_numeric INTEGER DEFAULT 16;

-- Update existing records to convert text font sizes to numeric equivalents
UPDATE menu_design_settings 
SET font_size_numeric = CASE 
  WHEN font_size = 'small' THEN 14
  WHEN font_size = 'medium' THEN 16
  WHEN font_size = 'large' THEN 18
  ELSE 16
END
WHERE font_size_numeric IS NULL;

-- Add comment for the new column
COMMENT ON COLUMN menu_design_settings.font_size_numeric IS 'Font size in pixels (8-24 range)';

-- Note: The old font_size column is kept for backward compatibility
-- You can drop it later if needed with: ALTER TABLE menu_design_settings DROP COLUMN font_size;
