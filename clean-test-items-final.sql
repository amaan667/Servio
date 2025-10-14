-- Clean up test items created during debugging
DELETE FROM menu_items 
WHERE venue_id = 'venue-1e02af4d' 
AND category IN ('Drinks', 'Food')
AND name IN ('Coffee', 'Tea', 'Sandwich')
AND created_at = '2025-10-14T11:23:15.175871+00:00';

-- Verify cleanup worked
SELECT category, COUNT(*) as count
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY category
ORDER BY MIN(created_at);
