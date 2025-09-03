-- Enable Row Level Security (RLS) on all tables that need it
-- This fixes the 503 Service Unavailable errors caused by RLS policies existing but RLS not being enabled

-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on menu_items table
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Enable RLS on order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Enable RLS on My_Table (if it exists and is needed)
-- ALTER TABLE public."My_Table" ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('orders', 'users', 'menu_items', 'order_items')
ORDER BY tablename;

-- Show existing RLS policies
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
    AND tablename IN ('orders', 'users', 'menu_items', 'order_items')
ORDER BY tablename, policyname;
