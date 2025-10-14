-- Debug why API can't find venue that exists
-- Step 1: Check what venues exist
SELECT venue_id, venue_name, owner_user_id, created_at 
FROM venues 
ORDER BY created_at DESC;

-- Step 2: Specifically look for our venue
SELECT venue_id, venue_name, business_type, owner_user_id
FROM venues 
WHERE venue_id = 'venue-1e02af4d';

-- Step 3: Check menu items count
SELECT 
    venue_id,
    COUNT(*) as total_items,
    COUNT(CASE WHEN is_available = true THEN 1 END) as available_items
FROM menu_items 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY venue_id;

-- Step 4: Check if there's a venue without the prefix
SELECT venue_id, venue_name 
FROM venues 
WHERE venue_id = '1e02af4d';

-- Step 5: Check user ownership
SELECT 
    v.venue_id,
    v.venue_name, 
    v.owner_user_id,
    u.email
FROM venues v
LEFT JOIN auth.users u ON v.owner_user_id = u.id
WHERE v.venue_id LIKE '%1e02af4d%';

-- Step 6: Check if RLS is blocking (this should work with service role)
SELECT 
    venue_id, 
    venue_name,
    'Found via direct query' as status
FROM venues 
WHERE venue_id IN ('venue-1e02af4d', '1e02af4d');
