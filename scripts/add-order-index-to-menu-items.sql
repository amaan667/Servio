-- Add order_index column to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create index for better performance when ordering
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items(venue_id, order_index);

-- Update existing items to have order_index based on created_at
UPDATE menu_items 
SET order_index = subquery.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY venue_id ORDER BY created_at) as row_num
  FROM menu_items
) as subquery
WHERE menu_items.id = subquery.id;
