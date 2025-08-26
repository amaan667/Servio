-- =====================================================
-- EMERGENCY DATABASE FIX - FORCE APPLY ALL FIXES
-- =====================================================
-- This script forcefully fixes all RLS policy issues and session problems

-- 1. FORCE CLEAR ALL EXISTING POLICIES
-- =====================================================

-- Drop ALL existing policies on problematic tables
DROP POLICY IF EXISTS "Venues are viewable by everyone" ON venues;
DROP POLICY IF EXISTS "Venues are insertable by authenticated users" ON venues;
DROP POLICY IF EXISTS "Users can insert their own venues" ON venues;
DROP POLICY IF EXISTS "Users can update their own venues" ON venues;
DROP POLICY IF EXISTS "Users can delete their own venues" ON venues;
DROP POLICY IF EXISTS "Venue owners can insert venues" ON venues;
DROP POLICY IF EXISTS "Venue owners can update venues" ON venues;
DROP POLICY IF EXISTS "Venue owners can delete venues" ON venues;

DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON menu_items;
DROP POLICY IF EXISTS "Menu items are insertable by venue managers" ON menu_items;
DROP POLICY IF EXISTS "Menu items are updatable by venue managers" ON menu_items;
DROP POLICY IF EXISTS "Menu items are deletable by venue managers" ON menu_items;
DROP POLICY IF EXISTS "Venue owners can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Venue owners can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Venue owners can delete menu items" ON menu_items;

DROP POLICY IF EXISTS "Orders are viewable by venue managers" ON orders;
DROP POLICY IF EXISTS "Orders are insertable by customers" ON orders;
DROP POLICY IF EXISTS "Orders are updatable by venue managers" ON orders;
DROP POLICY IF EXISTS "Venue owners can view orders" ON orders;
DROP POLICY IF EXISTS "Venue owners can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON orders;

DROP POLICY IF EXISTS "Users are viewable by admins" ON users;
DROP POLICY IF EXISTS "Users are insertable by admins" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

DROP POLICY IF EXISTS "Upload logs are viewable by venue managers" ON menu_upload_logs;
DROP POLICY IF EXISTS "Upload logs are insertable by venue managers" ON menu_upload_logs;
DROP POLICY IF EXISTS "Venue owners can view upload logs" ON menu_upload_logs;
DROP POLICY IF EXISTS "Venue owners can insert upload logs" ON menu_upload_logs;

-- 2. FORCE ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_upload_logs ENABLE ROW LEVEL SECURITY;

-- 3. CREATE CORRECT VENUES POLICIES
-- =====================================================

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

-- 4. CREATE CORRECT MENU_ITEMS POLICIES
-- =====================================================

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

-- 5. CREATE CORRECT ORDERS POLICIES
-- =====================================================

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

-- 6. CREATE CORRECT USERS POLICIES
-- =====================================================

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

-- 7. CREATE CORRECT MENU_UPLOAD_LOGS POLICIES
-- =====================================================

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

-- 8. FIX ORDER_ITEMS TABLE (if exists)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'order_items') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Order items are viewable by venue managers" ON order_items;
        DROP POLICY IF EXISTS "Order items are insertable by customers" ON order_items;
        DROP POLICY IF EXISTS "Order items are updatable by venue managers" ON order_items;
        DROP POLICY IF EXISTS "Venue owners can view order items" ON order_items;
        DROP POLICY IF EXISTS "Venue owners can update order items" ON order_items;
        DROP POLICY IF EXISTS "Anyone can insert order items" ON order_items;
        
        -- Enable RLS
        ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
        
        -- Create proper policies for order_items
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
        
        EXECUTE 'CREATE POLICY "Anyone can insert order items" 
                ON order_items FOR INSERT 
                WITH CHECK (true)';
        
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

-- 9. FORCE CREATE PROVISION FUNCTIONS
-- =====================================================

-- Ensure the provision_first_login function exists and is correct
CREATE OR REPLACE FUNCTION public.provision_first_login(new_user_id UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
    -- Create venue if none exists
    INSERT INTO venues (
        venue_id,
        name,
        owner_id,
        business_type,
        created_at,
        updated_at
    )
    SELECT 
        'venue-' || substr(new_user_id::text, 1, 8),
        'My Venue',
        new_user_id,
        'Restaurant',
        NOW(),
        NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM venues WHERE owner_id = new_user_id
    );

    -- Update first login timestamp if not set
    UPDATE profiles 
    SET first_login_at = NOW()
    WHERE id = new_user_id 
    AND first_login_at IS NULL;
END; 
$$;

-- Create profile creation function
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- 10. FORCE CREATE TRIGGERS
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_provision_new_user ON auth.users;
DROP TRIGGER IF EXISTS trigger_create_profile ON auth.users;

-- Create the triggers
CREATE TRIGGER trigger_provision_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.provision_first_login(NEW.id);

CREATE TRIGGER trigger_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_profile_for_user();

-- 11. FORCE GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.provision_first_login(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user() TO authenticated;

-- 12. VERIFICATION AND TESTING
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

-- Test venue creation function
CREATE OR REPLACE FUNCTION test_emergency_fixes()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
BEGIN
    -- Test 1: Check if provision function exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'provision_first_login') THEN
        result := result || '✅ provision_first_login function exists; ';
    ELSE
        result := result || '❌ provision_first_login function missing; ';
    END IF;
    
    -- Test 2: Check if triggers exist
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_provision_new_user') THEN
        result := result || '✅ provision trigger exists; ';
    ELSE
        result := result || '❌ provision trigger missing; ';
    END IF;
    
    -- Test 3: Check venue RLS policies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'venues' AND policyname = 'Users can insert their own venues') THEN
        result := result || '✅ venue insert policy exists; ';
    ELSE
        result := result || '❌ venue insert policy missing; ';
    END IF;
    
    -- Test 4: Check if RLS is enabled on venues
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'venues' AND rowsecurity = true) THEN
        result := result || '✅ RLS enabled on venues; ';
    ELSE
        result := result || '❌ RLS not enabled on venues; ';
    END IF;
    
    -- Test 5: Count total policies
    SELECT COUNT(*) INTO result FROM pg_policies WHERE schemaname = 'public';
    result := result || 'Total policies: ' || result || '; ';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT test_emergency_fixes();

-- Clean up test function
DROP FUNCTION test_emergency_fixes();

-- 13. FINAL STATUS
-- =====================================================

SELECT 'EMERGENCY DATABASE FIXES APPLIED SUCCESSFULLY' as status;