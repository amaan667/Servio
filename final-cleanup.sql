-- Final cleanup: Remove test items and ensure perfect PDF order
-- Remove test items created during debugging
DELETE FROM menu_items 
WHERE venue_id = 'venue-1e02af4d' 
AND category IN ('Drinks', 'Food')
AND name IN ('Coffee', 'Tea', 'Sandwich');

-- Verify final category structure
SELECT 
    category,
    COUNT(*) as item_count,
    MIN(created_at) as first_item_created
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d' 
GROUP BY category 
ORDER BY 
    CASE category
        WHEN 'STARTERS' THEN 1
        WHEN 'BRUNCH' THEN 2
        WHEN 'KIDS' THEN 3
        WHEN 'MAINS' THEN 4
        WHEN 'SALAD' THEN 5
        WHEN 'WRAPS & SANDWICHES' THEN 6
        WHEN 'DESSERTS' THEN 7
        WHEN 'COFFEE' THEN 8
        WHEN 'ICED COFFEE' THEN 9
        WHEN 'SPECIALITY COFFEE' THEN 10
        WHEN 'MILKSHAKES' THEN 11
        WHEN 'BEVERAGES' THEN 12
        WHEN 'TEA' THEN 13
        WHEN 'SPECIALS' THEN 14
        ELSE 99
    END;
