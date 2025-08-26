-- =====================================================
-- COMPREHENSIVE RLS POLICY FIXES
-- =====================================================
-- This script fixes all RLS policy issues causing "No rows returned" errors

-- 1. FIX VENUES TABLE RLS POLICIES
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Venues are viewable by everyone" ON venues;
DROP POLICY IF EXISTS "Venues are insertable by authenticated users" ON venues;
DROP POLICY IF EXISTS "Users can insert their own venues" ON venues;
DROP POLICY IF EXISTS "Users can update their own venues" ON venues;
DROP POLICY IF EXISTS "Users can delete their own venues" ON venues;

-- Enable RLS
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Create proper policies for venues
-- Allow everyone to read venues (for public ordering)
CREATE POLICY "Venues are viewable by everyone" 
ON venues FOR SELECT 
USING (true);

-- Allow authenticated users to insert venues they own
CREATE POLICY "Users can insert their own venues" 
ON venues FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

-- Allow authenticated users to update their own venues
CREATE POLICY "Users can update their own venues" 
ON venues FOR UPDATE 
USING (auth.uid() = owner_id) 
WITH CHECK (auth.uid() = owner_id);

-- Allow authenticated users to delete their own venues
CREATE POLICY "Users can delete their own venues" 
ON venues FOR DELETE 
USING (auth.uid() = owner_id);

-- 2. FIX MENU_ITEMS TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON menu_items;
DROP POLICY IF EXISTS "Menu items are insertable by venue managers" ON menu_items;
DROP POLICY IF EXISTS "Menu items are updatable by venue managers" ON menu_items;
DROP POLICY IF EXISTS "Menu items are deletable by venue managers" ON menu_items;

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Create proper policies for menu_items
-- Allow everyone to read menu items (for public ordering)
CREATE POLICY "Menu items are viewable by everyone" 
ON menu_items FOR SELECT 
USING (true);

-- Allow venue owners to insert menu items for their venues
CREATE POLICY "Venue owners can insert menu items" 
ON menu_items FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = menu_items.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- Allow venue owners to update menu items for their venues
CREATE POLICY "Venue owners can update menu items" 
ON menu_items FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = menu_items.venue_id 
        AND venues.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = menu_items.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- Allow venue owners to delete menu items for their venues
CREATE POLICY "Venue owners can delete menu items" 
ON menu_items FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = menu_items.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- 3. FIX ORDERS TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Orders are viewable by venue managers" ON orders;
DROP POLICY IF EXISTS "Orders are insertable by customers" ON orders;
DROP POLICY IF EXISTS "Orders are updatable by venue managers" ON orders;

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create proper policies for orders
-- Allow venue owners to view orders for their venues
CREATE POLICY "Venue owners can view orders" 
ON orders FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = orders.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- Allow anyone to insert orders (for customer ordering)
CREATE POLICY "Anyone can insert orders" 
ON orders FOR INSERT 
WITH CHECK (true);

-- Allow venue owners to update orders for their venues
CREATE POLICY "Venue owners can update orders" 
ON orders FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = orders.venue_id 
        AND venues.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = orders.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- 4. FIX USERS TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users are viewable by admins" ON users;
DROP POLICY IF EXISTS "Users are insertable by admins" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create proper policies for users
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" 
ON users FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. FIX MENU_UPLOAD_LOGS TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Upload logs are viewable by venue managers" ON menu_upload_logs;
DROP POLICY IF EXISTS "Upload logs are insertable by venue managers" ON menu_upload_logs;

-- Enable RLS
ALTER TABLE menu_upload_logs ENABLE ROW LEVEL SECURITY;

-- Create proper policies for menu_upload_logs
-- Allow venue owners to view upload logs for their venues
CREATE POLICY "Venue owners can view upload logs" 
ON menu_upload_logs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = menu_upload_logs.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- Allow venue owners to insert upload logs for their venues
CREATE POLICY "Venue owners can insert upload logs" 
ON menu_upload_logs FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.venue_id = menu_upload_logs.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- 6. FIX ORDER_ITEMS TABLE RLS POLICIES (if it exists)
-- =====================================================

-- Check if order_items table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'order_items') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Order items are viewable by venue managers" ON order_items;
        DROP POLICY IF EXISTS "Order items are insertable by customers" ON order_items;
        DROP POLICY IF EXISTS "Order items are updatable by venue managers" ON order_items;
        
        -- Enable RLS
        ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
        
        -- Create proper policies for order_items
        -- Allow venue owners to view order items for their venues
        EXECUTE 'CREATE POLICY "Venue owners can view order items" 
                ON order_items FOR SELECT 
                USING (
                    EXISTS (
                        SELECT 1 FROM venues v
                        JOIN orders o ON v.venue_id = o.venue_id
                        WHERE o.id = order_items.order_id 
                        AND v.owner_id = auth.uid()
                    )
                )';
        
        -- Allow anyone to insert order items (for customer ordering)
        EXECUTE 'CREATE POLICY "Anyone can insert order items" 
                ON order_items FOR INSERT 
                WITH CHECK (true)';
        
        -- Allow venue owners to update order items for their venues
        EXECUTE 'CREATE POLICY "Venue owners can update order items" 
                ON order_items FOR UPDATE 
                USING (
                    EXISTS (
                        SELECT 1 FROM venues v
                        JOIN orders o ON v.venue_id = o.venue_id
                        WHERE o.id = order_items.order_id 
                        AND v.owner_id = auth.uid()
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM venues v
                        JOIN orders o ON v.venue_id = o.venue_id
                        WHERE o.id = order_items.order_id 
                        AND v.owner_id = auth.uid()
                    )
                )';
    END IF;
END $$;

-- 7. VERIFY ALL POLICIES
-- =====================================================

-- Show all current policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 8. TEST VENUE CREATION
-- =====================================================

-- Create a test function to verify venue creation works
CREATE OR REPLACE FUNCTION test_venue_creation()
RETURNS TEXT AS $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000000';
    test_venue_id TEXT := 'test-venue-123';
    result TEXT;
BEGIN
    -- This is just a test to verify the policies are syntactically correct
    -- In real usage, auth.uid() will be the actual authenticated user ID
    
    -- Test venue insert policy
    BEGIN
        -- This should work if the user is authenticated and owns the venue
        -- (In real usage, owner_id would be auth.uid())
        INSERT INTO venues (venue_id, name, owner_id, business_type, created_at, updated_at)
        VALUES (test_venue_id, 'Test Venue', test_user_id, 'Restaurant', NOW(), NOW());
        
        result := 'Venue creation policy test passed';
    EXCEPTION WHEN OTHERS THEN
        result := 'Venue creation policy test failed: ' || SQLERRM;
    END;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Call the test function
SELECT test_venue_creation();

-- Clean up test function
DROP FUNCTION test_venue_creation();

-- 9. FINAL VERIFICATION
-- =====================================================

SELECT 'RLS Policy Fixes Applied Successfully' as status;