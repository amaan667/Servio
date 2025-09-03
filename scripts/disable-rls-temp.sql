-- Temporary fix: Disable RLS on menu_items table to get QR codes working
-- This is a quick fix - we can re-enable RLS with proper policies later

-- Disable RLS on menu_items table (temporary fix)
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;

-- Disable RLS on venues table (temporary fix)
ALTER TABLE public.venues DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('menu_items', 'venues')
ORDER BY tablename;

-- Test that menu items are now accessible
SELECT 
    'RLS Disabled Test' as test_type,
    COUNT(*) as total_menu_items,
    COUNT(DISTINCT venue_id) as total_venues,
    COUNT(CASE WHEN available = true THEN 1 END) as available_items
FROM public.menu_items;
