-- Add position column to menu_items table for drag and drop reordering

-- Add position column if it doesn't exist
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Set initial position values based on created_at
UPDATE menu_items
SET position = subquery.row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY venue_id, category ORDER BY created_at ASC) as row_number
  FROM menu_items
) AS subquery
WHERE menu_items.id = subquery.id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_menu_items_position 
ON menu_items(venue_id, category, position);

-- Add comment
COMMENT ON COLUMN menu_items.position IS 'Order position within category for drag and drop reordering';

