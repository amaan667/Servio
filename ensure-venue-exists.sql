-- First, check if venue exists and what data it has
SELECT 
    venue_id,
    venue_name,
    business_type,
    venue_address,
    phone,
    email,
    timezone,
    venue_type,
    service_type,
    owner_user_id,
    created_at,
    updated_at
FROM venues 
WHERE venue_id = 'venue-1e02af4d';

-- If venue doesn't exist, create it (run this if above query returns no results)
INSERT INTO venues (
    venue_id, 
    venue_name, 
    business_type, 
    venue_address, 
    phone,
    email,
    timezone,
    venue_type,
    service_type,
    owner_user_id,
    created_at,
    updated_at
)
VALUES (
    'venue-1e02af4d',  
    'Cafe Nur',
    'cafe', 
    '523 Kings Road, Stratford, Manchester',
    '+447927643391',
    'amaantanveer667@gmail.com',
    'Europe/London',
    'restaurant',
    'table_service',
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),
    NOW(),
    NOW()
)
ON CONFLICT (venue_id) DO UPDATE SET
    venue_name = EXCLUDED.venue_name,
    venue_address = EXCLUDED.venue_address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    timezone = EXCLUDED.timezone,
    venue_type = EXCLUDED.venue_type,
    service_type = EXCLUDED.service_type,
    updated_at = NOW();

-- Add some sample menu items if they don't exist
INSERT INTO menu_items (venue_id, name, description, price, category, is_available, created_at)
VALUES 
  ('venue-1e02af4d', 'Coffee', 'Fresh brewed coffee', 3.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Tea', 'Selection of teas', 2.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true, NOW()),
  ('venue-1e02af4d', 'Pastry', 'Fresh baked pastry', 4.00, 'Food', true, NOW())
ON CONFLICT DO NOTHING;
