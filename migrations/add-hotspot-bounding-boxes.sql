-- Add bounding box coordinates to menu_hotspots table
-- This enables smart overlay cards for menu items

ALTER TABLE menu_hotspots 
ADD COLUMN IF NOT EXISTS x1_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS y1_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS x2_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS y2_percent DECIMAL(5,2);

-- Add comment
COMMENT ON COLUMN menu_hotspots.x1_percent IS 'Left edge of bounding box (0-100%)';
COMMENT ON COLUMN menu_hotspots.y1_percent IS 'Top edge of bounding box (0-100%)';
COMMENT ON COLUMN menu_hotspots.x2_percent IS 'Right edge of bounding box (0-100%)';
COMMENT ON COLUMN menu_hotspots.y2_percent IS 'Bottom edge of bounding box (0-100%)';

-- These fields enable:
-- 1. Precise overlay positioning for each menu item
-- 2. Smart detection of multi-column menus
-- 3. Professional overlay cards instead of point-based buttons

