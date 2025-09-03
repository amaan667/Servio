-- Simple RLS fix to ensure customers can see menu items when scanning QR codes
-- This script directly fixes the RLS policies without complex logic

-- Step 1: Enable RLS on both tables
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated users to read their venue menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to update menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow service role full access to menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow anon users to read menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow anon users to read all menu items" ON public.menu_items;

-- Drop any venue policies that might exist
DROP POLICY IF EXISTS "Allow authenticated users to read their venues" ON public.venues;
DROP POLICY IF EXISTS "Allow authenticated users to insert venues" ON public.venues;
DROP POLICY IF EXISTS "Allow authenticated users to update their venues" ON public.venues;
DROP POLICY IF EXISTS "Allow authenticated users to delete their venues" ON public.venues;
DROP POLICY IF EXISTS "Allow service role full access to venues" ON public.venues;
DROP POLICY IF EXISTS "Allow anon users to read all venues" ON public.venues;

-- Step 3: Create simple, permissive policies for menu_items

-- Policy 1: Allow ANYONE to read menu items (for customer ordering)
CREATE POLICY "menu_items_select_policy" ON public.menu_items
    FOR SELECT
    TO public
    USING (true);

-- Policy 2: Allow authenticated users to manage their venue's menu items
CREATE POLICY "menu_items_manage_policy" ON public.menu_items
    FOR ALL
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

-- Step 4: Create simple, permissive policies for venues

-- Policy 1: Allow ANYONE to read venues (needed for menu item queries)
CREATE POLICY "venues_select_policy" ON public.venues
    FOR SELECT
    TO public
    USING (true);

-- Policy 2: Allow authenticated users to manage their venues
CREATE POLICY "venues_manage_policy" ON public.venues
    FOR ALL
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Step 5: Verify the policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('menu_items', 'venues')
ORDER BY tablename, policyname;

-- Step 6: Test that anonymous users can now access menu items
-- This should work after the policies are applied
SELECT 
    'RLS Test' as test_type,
    COUNT(*) as total_menu_items,
    COUNT(DISTINCT venue_id) as total_venues,
    COUNT(CASE WHEN available = true THEN 1 END) as available_items
FROM public.menu_items;
