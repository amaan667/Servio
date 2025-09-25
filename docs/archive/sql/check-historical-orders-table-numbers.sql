-- SQL script to check table numbers for historical orders
-- This will help identify if table numbers exist in the database for orders

-- 1. Check overall statistics of table_number field
SELECT 
    'Overall Statistics' as analysis_type,
    COUNT(*) as total_orders,
    COUNT(table_number) as orders_with_table_number,
    COUNT(*) - COUNT(table_number) as orders_without_table_number,
    ROUND((COUNT(table_number)::numeric / COUNT(*)) * 100, 2) as percentage_with_table_number
FROM orders;

-- 2. Check table_number distribution by source
SELECT 
    'By Source' as analysis_type,
    source,
    COUNT(*) as total_orders,
    COUNT(table_number) as orders_with_table_number,
    COUNT(*) - COUNT(table_number) as orders_without_table_number,
    ROUND((COUNT(table_number)::numeric / COUNT(*)) * 100, 2) as percentage_with_table_number
FROM orders 
GROUP BY source
ORDER BY source;

-- 3. Check table_number distribution by date (last 30 days)
SELECT 
    'By Date (Last 30 Days)' as analysis_type,
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    COUNT(table_number) as orders_with_table_number,
    COUNT(*) - COUNT(table_number) as orders_without_table_number,
    ROUND((COUNT(table_number)::numeric / COUNT(*)) * 100, 2) as percentage_with_table_number
FROM orders 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

-- 4. Sample of orders without table numbers (recent ones)
SELECT 
    'Sample Orders Without Table Numbers' as analysis_type,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    created_at,
    order_status,
    payment_status
FROM orders 
WHERE table_number IS NULL 
    AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Sample of orders with table numbers (recent ones)
SELECT 
    'Sample Orders With Table Numbers' as analysis_type,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    created_at,
    order_status,
    payment_status
FROM orders 
WHERE table_number IS NOT NULL 
    AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check if there are any patterns in table_id vs table_number
SELECT 
    'Table ID vs Table Number Analysis' as analysis_type,
    CASE 
        WHEN table_id IS NOT NULL AND table_number IS NOT NULL THEN 'Both present'
        WHEN table_id IS NOT NULL AND table_number IS NULL THEN 'Only table_id'
        WHEN table_id IS NULL AND table_number IS NOT NULL THEN 'Only table_number'
        ELSE 'Neither present'
    END as data_availability,
    COUNT(*) as count
FROM orders
GROUP BY 
    CASE 
        WHEN table_id IS NOT NULL AND table_number IS NOT NULL THEN 'Both present'
        WHEN table_id IS NOT NULL AND table_number IS NULL THEN 'Only table_id'
        WHEN table_id IS NULL AND table_number IS NOT NULL THEN 'Only table_number'
        ELSE 'Neither present'
    END
ORDER BY count DESC;

-- 7. Check for orders that might have table information in other fields
SELECT 
    'Orders with table_id but no table_number' as analysis_type,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    created_at
FROM orders 
WHERE table_id IS NOT NULL 
    AND table_number IS NULL
    AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 20;

-- 8. Check for any orders that might have table information in notes or other fields
SELECT 
    'Orders with table info in notes' as analysis_type,
    id,
    table_number,
    table_id,
    notes,
    source,
    customer_name,
    created_at
FROM orders 
WHERE notes IS NOT NULL 
    AND (notes ILIKE '%table%' OR notes ILIKE '%Table%')
    AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 10;

