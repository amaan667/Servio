-- Create the missing venue
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

-- Add some sample menu items
INSERT INTO menu_items (venue_id, name, description, price, category, is_available)
VALUES 
  ('venue-1e02af4d', 'Coffee', 'Fresh brewed coffee', 3.50, 'Drinks', true),
  ('venue-1e02af4d', 'Tea', 'Selection of teas', 2.50, 'Drinks', true),
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true)
ON CONFLICT DO NOTHING;
