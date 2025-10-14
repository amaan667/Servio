-- Check what the original PDF category order was
SELECT 
    venue_id,
    category_order,
    created_at,
    filename
FROM menu_uploads 
WHERE venue_id = 'venue-1e02af4d' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check current categories in menu items
SELECT 
    category,
    COUNT(*) as item_count,
    MIN(created_at) as first_item_created
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d' 
GROUP BY category 
ORDER BY MIN(created_at);

-- Optional: Manually set the correct category order if needed
-- UPDATE menu_uploads 
-- SET category_order = '["SPECIALS", "STARTERS", "BRUNCH", "MAINS", "SALAD", "WRAPS & SANDWICHES", "COFFEE", "SPECIALITY COFFEE", "ICED COFFEE", "TEA", "BEVERAGES", "MILKSHAKES", "KIDS", "Drinks", "Food"]'::jsonb,
--     updated_at = NOW()
-- WHERE venue_id = 'venue-1e02af4d' 
-- AND created_at = (SELECT MAX(created_at) FROM menu_uploads WHERE venue_id = 'venue-1e02af4d');
