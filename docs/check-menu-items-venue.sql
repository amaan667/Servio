-- Check if menu items are incorrectly shared between venues
-- Run this in Supabase SQL Editor

-- 1. Check menu items for Cafe Nur (venue-1e02af4d)
SELECT 
  COUNT(*) as count,
  venue_id,
  'Cafe Nur' as venue_name
FROM menu_items
WHERE venue_id = 'venue-1e02af4d'
GROUP BY venue_id;

-- 2. Check menu items for Cafe Begum (replace with actual venue_id)
-- Get the actual venue_id for Cafe Begum first:
SELECT venue_id, venue_name 
FROM venues 
WHERE venue_name ILIKE '%begum%';

-- Then check its menu items (replace VENUE_ID_HERE with actual ID):
-- SELECT COUNT(*) as count, venue_id
-- FROM menu_items
-- WHERE venue_id = 'VENUE_ID_HERE';

-- 3. Check if there are menu items with wrong venue_id
SELECT 
  mi.id,
  mi.name,
  mi.venue_id as menu_item_venue_id,
  v.venue_name
FROM menu_items mi
LEFT JOIN venues v ON mi.venue_id = v.venue_id
WHERE mi.venue_id IN (
  SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()
)
ORDER BY mi.venue_id, mi.created_at
LIMIT 20;

