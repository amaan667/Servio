-- Clean up duplicate menu items from existing database
-- This script removes duplicates based on name and venue_id

-- First, let's see what duplicates exist
SELECT 
    venue_id,
    name,
    COUNT(*) as duplicate_count
FROM menu_items 
GROUP BY venue_id, LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Remove duplicates, keeping only the first occurrence of each item
DELETE FROM menu_items 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY venue_id, LOWER(TRIM(name)) 
                   ORDER BY created_at ASC
               ) as rn
        FROM menu_items
    ) t
    WHERE t.rn > 1
);

-- Show the results after cleanup
SELECT 
    venue_id,
    COUNT(*) as total_items
FROM menu_items 
GROUP BY venue_id
ORDER BY total_items DESC; 