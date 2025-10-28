-- Compare menu items between the two venues
-- Run this in Supabase SQL Editor

-- 1. Get venue names
SELECT venue_id, venue_name 
FROM venues 
WHERE venue_id IN ('venue-78f813f1067648209f37df3affc60b58', 'venue-1e02af4d');

-- 2. Check if menu items are identical (same names)
-- Items in Cafe Nur but not in Cafe Begum
SELECT 'In Cafe Nur only' as status, name, category
FROM menu_items
WHERE venue_id = 'venue-1e02af4d'
  AND name NOT IN (
    SELECT name FROM menu_items 
    WHERE venue_id = 'venue-78f813f1067648209f37df3affc60b58'
  )
LIMIT 10;

-- 3. Items in Cafe Begum but not in Cafe Nur
SELECT 'In Cafe Begum only' as status, name, category
FROM menu_items
WHERE venue_id = 'venue-78f813f1067648209f37df3affc60b58'
  AND name NOT IN (
    SELECT name FROM menu_items 
    WHERE venue_id = 'venue-1e02af4d'
  )
LIMIT 10;

-- 4. Check if they have the exact same menu (duplicates)
SELECT 
  COUNT(DISTINCT mi1.name) as shared_items,
  (SELECT COUNT(*) FROM menu_items WHERE venue_id = 'venue-1e02af4d') as cafe_nur_total,
  (SELECT COUNT(*) FROM menu_items WHERE venue_id = 'venue-78f813f1067648209f37df3affc60b58') as cafe_begum_total
FROM menu_items mi1
WHERE mi1.venue_id = 'venue-1e02af4d'
  AND EXISTS (
    SELECT 1 FROM menu_items mi2
    WHERE mi2.venue_id = 'venue-78f813f1067648209f37df3affc60b58'
    AND mi2.name = mi1.name
  );

-- 5. Sample items from each venue
SELECT venue_id, name, category, price, created_at
FROM menu_items
WHERE venue_id IN ('venue-1e02af4d', 'venue-78f813f1067648209f37df3affc60b58')
ORDER BY venue_id, created_at
LIMIT 20;

