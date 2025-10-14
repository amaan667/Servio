-- Remove test items that were created during debugging
-- These are not from the original PDF

-- Check what test items exist
SELECT id, name, category, description, created_at 
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d' 
AND category IN ('Drinks', 'Food')
ORDER BY created_at DESC;

-- Remove the test items (these were added during debugging)
DELETE FROM menu_items 
WHERE venue_id = 'venue-1e02af4d' 
AND category IN ('Drinks', 'Food')
AND name IN ('Coffee', 'Tea', 'Sandwich', 'Pastry');

-- Verify they were removed
SELECT category, COUNT(*) as count
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY category
ORDER BY MIN(created_at);
