-- Add bounding box columns to existing menu_items table
-- This allows pixel-perfect button placement without duplicating data
-- Run this in Supabase SQL Editor

-- Add bbox columns to menu_items (if they don't exist)
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS bbox_x REAL;
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS bbox_y REAL;
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS bbox_w REAL;
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS bbox_h REAL;
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS page_number INTEGER;
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS pdf_image_url TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_bbox ON menu_items(bbox_x, bbox_y);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_items' 
AND column_name LIKE 'bbox%'
ORDER BY ordinal_position;

