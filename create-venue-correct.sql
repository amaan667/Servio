-- Check what venues currently exist
SELECT venue_id, venue_name, owner_user_id, created_at
FROM venues 
ORDER BY created_at DESC;

-- Check if we have any users
SELECT id, email, user_metadata->>'full_name' as full_name
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Create the missing venue that QR codes expect (using correct column names)
INSERT INTO venues (
    venue_id, 
    venue_name, 
    business_type, 
    venue_address, 
    owner_user_id,
    created_at,
    updated_at
)
VALUES (
    'venue-1e02af4d',  
    'Cafe Nur',
    'cafe', 
    '123 Main Street',
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),  -- Use your most recent user
    NOW(),
    NOW()
)
ON CONFLICT (venue_id) DO UPDATE SET
    venue_name = EXCLUDED.venue_name,
    updated_at = NOW();

-- Add some sample menu items
INSERT INTO menu_items (venue_id, name, description, price, category, is_available, created_at)
VALUES 
  ('venue-1e02af4d', 'Coffee', 'Fresh brewed coffee', 3.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Tea', 'Selection of teas', 2.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true, NOW()),
  ('venue-1e02af4d', 'Pastry', 'Fresh baked pastry', 4.00, 'Food', true, NOW())
ON CONFLICT DO NOTHING;

-- Verify it was created
SELECT 
    v.venue_id, 
    v.venue_name, 
    v.owner_user_id,
    COUNT(mi.id) as menu_items_count
FROM venues v
LEFT JOIN menu_items mi ON v.venue_id = mi.venue_id AND mi.is_available = true
WHERE v.venue_id = 'venue-1e02af4d'
GROUP BY v.venue_id, v.venue_name, v.owner_user_id;
