-- Add button position columns to menu_hotspots table
-- These columns store the specific x,y position for the "Add to Cart" button

ALTER TABLE menu_hotspots 
ADD COLUMN IF NOT EXISTS button_x_percent NUMERIC,
ADD COLUMN IF NOT EXISTS button_y_percent NUMERIC;

COMMENT ON COLUMN menu_hotspots.button_x_percent IS 'X position (0-100%) for the Add to Cart button';
COMMENT ON COLUMN menu_hotspots.button_y_percent IS 'Y position (0-100%) for the Add to Cart button';

