-- Check what columns actually exist in venues table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'venues' 
ORDER BY ordinal_position;

-- Check current venue data
SELECT venue_id, venue_name, address, phone, email, business_type, owner_user_id
FROM venues 
WHERE venue_id = 'venue-1e02af4d';

-- Create venue with correct column names (address, not venue_address)
INSERT INTO venues (
    venue_id, 
    venue_name, 
    business_type, 
    address, 
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
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    timezone = EXCLUDED.timezone,
    venue_type = EXCLUDED.venue_type,
    service_type = EXCLUDED.service_type,
    updated_at = NOW();

-- Add menu items
INSERT INTO menu_items (venue_id, name, description, price, category, is_available, created_at)
VALUES 
  ('venue-1e02af4d', 'Coffee', 'Fresh brewed coffee', 3.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Tea', 'Selection of teas', 2.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true, NOW()),
  ('venue-1e02af4d', 'Pastry', 'Fresh baked pastry', 4.00, 'Food', true, NOW())
ON CONFLICT DO NOTHING;

-- Verify everything is created
SELECT 
    v.venue_id, 
    v.venue_name, 
    v.address,
    v.phone,
    v.email,
    v.owner_user_id,
    COUNT(mi.id) as menu_items_count
FROM venues v
LEFT JOIN menu_items mi ON v.venue_id = mi.venue_id AND mi.is_available = true
WHERE v.venue_id = 'venue-1e02af4d'
GROUP BY v.venue_id, v.venue_name, v.address, v.phone, v.email, v.owner_user_id;
