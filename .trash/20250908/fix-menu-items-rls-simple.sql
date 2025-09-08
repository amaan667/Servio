-- Simple fix for menu_items RLS policies
-- This ensures PDF-processed items are visible to venue owners

-- Step 1: Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are insertable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are updatable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are deletable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to read their venue menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to update menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete menu items for their venues" ON public.menu_items;
DROP POLICY IF EXISTS "Allow service role full access to menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow anon users to read menu items" ON public.menu_items;

-- Step 2: Create simple, working policies

-- Policy 1: Allow service role full access (for PDF processing)
CREATE POLICY "Service role full access" ON public.menu_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 2: Allow authenticated users to read menu items for venues they own
CREATE POLICY "Authenticated users can read their venue menu items" ON public.menu_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 3: Allow authenticated users to insert menu items for venues they own
CREATE POLICY "Authenticated users can insert menu items for their venues" ON public.menu_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 4: Allow authenticated users to update menu items for venues they own
CREATE POLICY "Authenticated users can update menu items for their venues" ON public.menu_items
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

-- Policy 5: Allow authenticated users to delete menu items for venues they own
CREATE POLICY "Authenticated users can delete menu items for their venues" ON public.menu_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 6: Allow anonymous users to read menu items (for public menu display)
CREATE POLICY "Anonymous users can read menu items" ON public.menu_items
    FOR SELECT
    TO anon
    USING (true);

-- Step 3: Verify the setup
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

-- Step 4: Test by checking if we can see menu items
SELECT 
    COUNT(*) as total_menu_items,
    COUNT(DISTINCT venue_id) as unique_venues
FROM public.menu_items;
