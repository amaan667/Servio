-- Add position column to menu_items table
-- This allows menu items to be reordered within their categories

-- Add position column (default to 0 for existing items)
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_items_position 
ON menu_items(venue_id, category, position);

-- Update existing items to have sequential positions within their categories
DO $$
DECLARE
    venue_rec RECORD;
    cat_rec RECORD;
    item_rec RECORD;
    pos INTEGER;
BEGIN
    -- Loop through each venue
    FOR venue_rec IN SELECT DISTINCT venue_id FROM menu_items LOOP
        -- Loop through each category in this venue
        FOR cat_rec IN 
            SELECT DISTINCT category 
            FROM menu_items 
            WHERE venue_id = venue_rec.venue_id
        LOOP
            -- Now update with correct sequential positions
            pos := 0;
            FOR item_rec IN 
                SELECT id FROM menu_items
                WHERE venue_id = venue_rec.venue_id 
                  AND category = cat_rec.category
                ORDER BY created_at ASC
            LOOP
                UPDATE menu_items
                SET position = pos
                WHERE id = item_rec.id;
                pos := pos + 1;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Add comment to column
COMMENT ON COLUMN menu_items.position IS 'Display order of items within their category';

