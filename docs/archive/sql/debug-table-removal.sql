-- Debug script for table removal issues
-- This script helps identify potential database connectivity or schema issues

-- 1. Check if the orders table exists and has the expected structure
SELECT 'Checking orders table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if the reservations table exists and has the expected structure
SELECT 'Checking reservations table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if the tables table exists and has the expected structure
SELECT 'Checking tables table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tables' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Test a simple query on orders table
SELECT 'Testing simple orders query:' as info;
SELECT COUNT(*) as total_orders FROM orders LIMIT 1;

-- 5. Test the exact query used in the API
SELECT 'Testing API orders query:' as info;
SELECT COUNT(*) as active_orders_count
FROM orders
WHERE table_id IS NOT NULL
  AND venue_id IS NOT NULL
  AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
LIMIT 1;

-- 6. Check for any constraints or indexes that might be causing issues
SELECT 'Checking constraints on orders table:' as info;
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'orders' 
  AND table_schema = 'public';

-- 7. Check for any foreign key constraints
SELECT 'Checking foreign key constraints:' as info;
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (tc.table_name = 'orders' OR tc.table_name = 'reservations' OR tc.table_name = 'tables')
  AND tc.table_schema = 'public';

-- 8. Check if there are any sample tables to test with
SELECT 'Sample tables for testing:' as info;
SELECT id, label, venue_id, created_at
FROM tables
ORDER BY created_at DESC
LIMIT 5;

-- 9. Check if there are any sample orders to test with
SELECT 'Sample orders for testing:' as info;
SELECT id, table_id, venue_id, order_status, created_at
FROM orders
WHERE table_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;