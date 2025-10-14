# Step-by-Step Fix for "Venue Not Found"

## Current Issue
The venue `venue-1e02af4d` doesn't exist in your database, causing "venue not found" errors.

## Step-by-Step Solution

### Step 1: Check If Venue Exists
Run this in **Supabase SQL Editor** first:

```sql
-- Check if venue exists
SELECT venue_id, venue_name, owner_user_id 
FROM venues 
WHERE venue_id = 'venue-1e02af4d';
```

**Expected Result:** If venue doesn't exist, you'll see "No rows returned"

### Step 2: Check Your User ID
Run this to see your user ID:

```sql
-- Get your user ID
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
```

### Step 3: Create the Venue
Copy and run this **EXACT** SQL in Supabase:

```sql
-- Create the venue (replace YOUR_USER_ID with actual ID from Step 2)
INSERT INTO venues (
    venue_id, 
    venue_name, 
    business_type, 
    address, 
    phone,
    email,
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
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),
    NOW(),
    NOW()
);
```

### Step 4: Add Menu Items
```sql
-- Add sample menu items
INSERT INTO menu_items (venue_id, name, description, price, category, is_available, created_at)
VALUES 
  ('venue-1e02af4d', 'Coffee', 'Fresh brewed coffee', 3.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Tea', 'Selection of teas', 2.50, 'Drinks', true, NOW()),
  ('venue-1e02af4d', 'Sandwich', 'Fresh sandwich', 8.50, 'Food', true, NOW()),
  ('venue-1e02af4d', 'Pastry', 'Fresh baked pastry', 4.00, 'Food', true, NOW());
```

### Step 5: Verify It Worked
```sql
-- Check venue was created with menu items
SELECT 
    v.venue_id, 
    v.venue_name, 
    v.owner_user_id,
    COUNT(mi.id) as menu_items_count
FROM venues v
LEFT JOIN menu_items mi ON v.venue_id = mi.venue_id
WHERE v.venue_id = 'venue-1e02af4d'
GROUP BY v.venue_id, v.venue_name, v.owner_user_id;
```

### Step 6: Test Customer Ordering
After running the SQL, test these URLs:
- `https://servio-production.up.railway.app/order?venue=venue-1e02af4d&table=1`
- Your settings page should also work

## ⚠️ Important
You MUST actually run the SQL in Supabase for this to work. The venue doesn't exist until you create it.
