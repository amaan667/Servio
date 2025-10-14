# Quick Venue Fix

## Problem
The customer ordering UI shows "error loading menu : venue not found" because the venue `venue-1e02af4d` doesn't exist in the database.

## Solution
Run this SQL in your Supabase SQL Editor to create the venue:

```sql
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
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true),
  ('venue-1e02af4d', 'Pastry', 'Fresh baked pastry', 4.00, 'Food', true)
ON CONFLICT DO NOTHING;
```

## What Was Fixed
1. **Enhanced Menu API** - Now handles both venue ID formats (`venue-xyz` and `xyz`)
2. **Added Debugging** - Added console logging to help troubleshoot venue lookup issues
3. **Fallback Lookup** - API tries both transformed and original venue IDs

## Testing
After running the SQL, test the customer ordering flow:
1. Go to `/order?venue=venue-1e02af4d&table=1`
2. The menu should now load correctly

## Alternative URLs to Test
- `/order?venue=venue-1e02af4d&table=1` (full venue ID)
- `/order?venue=1e02af4d&table=1` (short venue ID - should work with the API fix)
- `/order?demo=1` (demo mode)
