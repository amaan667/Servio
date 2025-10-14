-- The venue exists! Let's debug why the API can't find it

-- Step 1: Check the venue data
SELECT 
    venue_id, 
    venue_name, 
    business_type,
    owner_user_id,
    created_at,
    updated_at
FROM venues 
WHERE venue_id = 'venue-1e02af4d';

-- Step 2: Check if it has menu items
SELECT 
    venue_id,
    name,
    price,
    category,
    is_available
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d';

-- Step 3: Check your user ID
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Step 4: Check if venue owner matches your user
SELECT 
    v.venue_id,
    v.venue_name,
    v.owner_user_id,
    u.email as owner_email
FROM venues v
JOIN auth.users u ON v.owner_user_id = u.id
WHERE v.venue_id = 'venue-1e02af4d';

-- Step 5: If venue has no menu items, add some
INSERT INTO menu_items (venue_id, name, description, price, category, is_available, created_at)
VALUES 
  ('venue-1e02af4d', 'Coffee', 'Fresh brewed coffee', 3.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Tea', 'Selection of teas', 2.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true, NOW())
ON CONFLICT DO NOTHING;

-- Step 6: Final check - venue with menu count
SELECT 
    v.venue_id, 
    v.venue_name, 
    v.owner_user_id,
    COUNT(mi.id) as menu_items_count
FROM venues v
LEFT JOIN menu_items mi ON v.venue_id = mi.venue_id AND mi.is_available = true
WHERE v.venue_id = 'venue-1e02af4d'
GROUP BY v.venue_id, v.venue_name, v.owner_user_id;
