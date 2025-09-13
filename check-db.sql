-- Check recent orders and their table assignments
SELECT 
    'Recent orders (last 10):' as info,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    venue_id
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC 
LIMIT 10;

-- Check specifically for orders with table_number = 9
SELECT 
    'Orders with table_number = 9:' as info,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND table_number = 9
ORDER BY created_at DESC 
LIMIT 5;

-- Check specifically for orders with table_number = 1
SELECT 
    'Orders with table_number = 1:' as info,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND table_number = 1
ORDER BY created_at DESC 
LIMIT 5;

-- Check the table_runtime_state to see available tables
SELECT 
    'Available tables in table_runtime_state:' as info,
    id,
    label,
    venue_id,
    primary_status,
    created_at
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
  AND is_active = true
ORDER BY label;

-- Check for any orders that might be showing incorrectly
SELECT 
    'Orders from today with their source and table info:' as info,
    id,
    table_number,
    table_id,
    source,
    customer_name,
    order_status,
    payment_status,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;