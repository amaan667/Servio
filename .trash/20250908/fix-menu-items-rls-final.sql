-- Final RLS fix for menu items to ensure customers can see menu items when scanning QR codes
-- This script addresses the issue where customers can't see menu items due to restrictive RLS policies

-- Step 1: Enable RLS on both tables
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read their venue menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to update menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow service role full access to menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow anon users to read menu items" ON public.menu_items;

-- Drop venue policies if they exist
DROP POLICY IF EXISTS "Allow anon users to read venues" ON public.venues;

-- Step 3: Create comprehensive RLS policies for menu_items table

-- Policy 1: Allow authenticated users to read menu items for venues they own
CREATE POLICY "Allow authenticated users to read their venue menu items" ON public.menu_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 2: Allow authenticated users to insert menu items for venues they own
CREATE POLICY "Allow authenticated users to insert menu items for their venues" ON public.menu_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 3: Allow authenticated users to update menu items for venues they own
CREATE POLICY "Allow authenticated users to update menu items for their venues" ON public.menu_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 4: Allow authenticated users to delete menu items for venues they own
CREATE POLICY "Allow authenticated users to delete menu items for their venues" ON public.menu_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 5: Allow service role full access (for PDF processing and other automated operations)
CREATE POLICY "Allow service role full access to menu items" ON public.menu_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 6: CRITICAL - Allow anonymous users to read ALL menu items (for customer ordering)
CREATE POLICY "Allow anon users to read all menu items" ON public.menu_items
    FOR SELECT
    TO anon
    USING (true);

-- Step 4: Create RLS policies for venues table

-- Policy 1: Allow authenticated users to read venues they own
CREATE POLICY "Allow authenticated users to read their venues" ON public.venues
    FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

-- Policy 2: Allow authenticated users to insert venues
CREATE POLICY "Allow authenticated users to insert venues" ON public.venues
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Policy 3: Allow authenticated users to update venues they own
CREATE POLICY "Allow authenticated users to update their venues" ON public.venues
    FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Policy 4: Allow authenticated users to delete venues they own
CREATE POLICY "Allow authenticated users to delete their venues" ON public.venues
    FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- Policy 5: Allow service role full access to venues
CREATE POLICY "Allow service role full access to venues" ON public.venues
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 6: CRITICAL - Allow anonymous users to read ALL venues (needed for menu item queries with joins)
CREATE POLICY "Allow anon users to read all venues" ON public.venues
    FOR SELECT
    TO anon
    USING (true);

-- Step 5: Verify the setup
-- Check RLS status for both tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('menu_items', 'venues')
ORDER BY tablename;

-- Check RLS policies for both tables
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
    AND tablename IN ('menu_items', 'venues')
ORDER BY tablename, policyname;

-- Test anonymous access to menu items
-- This should return results for anonymous users
SELECT 
    'Anonymous access test' as test_type,
    COUNT(*) as menu_items_count,
    COUNT(DISTINCT venue_id) as venues_count
FROM public.menu_items 
WHERE available = true;
