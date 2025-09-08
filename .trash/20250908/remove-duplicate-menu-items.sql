-- Remove duplicate menu items based on normalized names
-- This script will keep the first occurrence of each item and remove duplicates

-- Create a function to normalize item names (same logic as the application)
CREATE OR REPLACE FUNCTION normalize_item_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[-\s]+', ' ', 'g'), -- Replace hyphens and multiple spaces with single space
      '[^\w\s]', '', 'g' -- Remove special characters except letters, numbers, and spaces
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Find and remove duplicates, keeping the first occurrence (lowest ID)
WITH duplicates AS (
  SELECT 
    id,
    name,
    normalize_item_name(name) as normalized_name,
    ROW_NUMBER() OVER (
      PARTITION BY venue_id, normalize_item_name(name) 
      ORDER BY id ASC
    ) as rn
  FROM menu_items
)
DELETE FROM menu_items 
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
);

-- Show the results
SELECT 
  COUNT(*) as total_items_after_cleanup,
  COUNT(DISTINCT venue_id) as unique_venues
FROM menu_items;

-- Show items by venue for verification
SELECT 
  venue_id,
  COUNT(*) as item_count,
  COUNT(DISTINCT normalize_item_name(name)) as unique_normalized_names
FROM menu_items
GROUP BY venue_id
ORDER BY venue_id;

-- Clean up the function
DROP FUNCTION IF EXISTS normalize_item_name(TEXT);
