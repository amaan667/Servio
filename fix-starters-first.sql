-- Update the category order to place "STARTERS" first as requested
UPDATE menu_uploads
SET category_order = '["STARTERS", "SPECIALS", "BRUNCH", "MAINS", "SALAD", "WRAPS & SANDWICHES", "DESSERTS", "COFFEE", "ICED COFFEE", "SPECIALITY COFFEE", "MILKSHAKES", "BEVERAGES", "TEA", "KIDS"]'::jsonb,
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
AND created_at = (SELECT MAX(created_at) FROM menu_uploads WHERE venue_id = 'venue-1e02af4d');

-- Verify the updated order
SELECT category_order
FROM menu_uploads
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC
LIMIT 1;
