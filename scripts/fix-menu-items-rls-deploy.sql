-- Fix RLS policies for menu_items table to ensure PDF-processed items are visible
-- This script addresses the issue where PDF processing inserts items but they don't appear in the menu management interface

-- Step 1: Enable RLS on menu_items table (if not already enabled)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are insertable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are updatable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are deletable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Service role can manage menu items" ON public.menu_items;

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

-- Policy 6: Allow anon users to read menu items (for public menu display)
CREATE POLICY "Allow anon users to read menu items" ON public.menu_items
    FOR SELECT
    TO anon
    USING (true);

-- Step 4: Verify the setup
-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename = 'menu_items';

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'menu_items'
ORDER BY policyname;

-- Step 5: Test the policies by checking if we can see existing menu items
SELECT 
    COUNT(*) as total_menu_items,
    COUNT(DISTINCT venue_id) as unique_venues,
    COUNT(DISTINCT category) as unique_categories
FROM public.menu_items;

-- Step 6: Check if there are any menu items that might be hidden due to RLS
SELECT 
    venue_id,
    COUNT(*) as item_count,
    MIN(created_at) as oldest_item,
    MAX(created_at) as newest_item
FROM public.menu_items 
GROUP BY venue_id 
ORDER BY item_count DESC;
