-- ========================================
-- VENUE SETUP CHECK AND FIX SCRIPT
-- ========================================

-- Check if you have any venues
SELECT 
  venue_id,
  venue_name,
  owner_user_id,
  created_at
FROM venues
ORDER BY created_at DESC;

-- Check menu items count per venue
SELECT 
  v.venue_id,
  v.venue_name,
  COUNT(mi.id) as total_items,
  COUNT(mi.id) FILTER (WHERE mi.is_available = true) as available_items
FROM venues v
LEFT JOIN menu_items mi ON v.venue_id = mi.venue_id
GROUP BY v.venue_id, v.venue_name
ORDER BY v.created_at DESC;

-- If you need to create a test venue, uncomment and run this:
/*
INSERT INTO venues (venue_id, venue_name, venue_address, cuisine_type, owner_user_id)
VALUES (
  'venue-1e02af4d',  -- Must match your QR code venueId
  'Cafe Nur',
  '123 Main Street',
  'Cafe',
  (SELECT id FROM auth.users LIMIT 1)  -- Uses your first user as owner
)
ON CONFLICT (venue_id) DO UPDATE 
SET venue_name = EXCLUDED.venue_name;
*/

-- Check for venues with no menu items (might cause "no menu" errors)
SELECT 
  v.venue_id,
  v.venue_name,
  'No menu items found' as issue
FROM venues v
LEFT JOIN menu_items mi ON v.venue_id = mi.venue_id
WHERE mi.id IS NULL;

-- Verify your venues table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'venues'
ORDER BY ordinal_position;

