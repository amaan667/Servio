-- Add dietary information and spice_level columns to menu_items table
-- This migration adds support for dietary tags and spice level information

-- Add dietary column (array of dietary tags)
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS dietary text[] DEFAULT '{}';

-- Add spice_level column (nullable integer: null=no spice, 1=mild, 2=medium, 3=hot)
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS spice_level integer DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN menu_items.dietary IS 'Dietary information tags (e.g., vegetarian, vegan, gluten-free, halal, kosher)';
COMMENT ON COLUMN menu_items.spice_level IS 'Spice level indicator: null=none, 1=mild, 2=medium, 3=hot';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary ON menu_items USING GIN (dietary);
CREATE INDEX IF NOT EXISTS idx_menu_items_spice_level ON menu_items (spice_level) WHERE spice_level IS NOT NULL;

