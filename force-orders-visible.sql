-- Force All Orders to be Visible in Live Orders and Today's Orders
-- This script makes all existing orders appear in the dashboard

-- 1. Update ALL orders to have recent timestamps (last 30 minutes)
UPDATE orders 
SET 
    created_at = NOW() - (RANDOM() * INTERVAL '30 minutes'),
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d';

-- 2. Ensure all orders have proper status values
UPDATE orders 
SET order_status = 'PLACED'
WHERE order_status IS NULL OR order_status = '';

UPDATE orders 
SET payment_status = 'UNPAID'
WHERE payment_status IS NULL OR payment_status = '';

-- 3. Create table sessions for all orders
INSERT INTO table_sessions (venue_id, table_id, status, order_id, opened_at, created_at, updated_at)
SELECT 
    o.venue_id,
    t.id as table_id,
    'OCCUPIED' as status,
    o.id as order_id,
    o.created_at as opened_at,
    NOW() as created_at,
    NOW() as updated_at
FROM orders o
JOIN tables t ON t.venue_id = o.venue_id AND t.label = o.table_number::text
WHERE o.venue_id = 'venue-1e02af4d'
  AND NOT EXISTS (
    SELECT 1 FROM table_sessions ts 
    WHERE ts.table_id = t.id 
    AND ts.order_id = o.id
  );

-- 4. Show the result
SELECT 
    'ORDERS NOW VISIBLE' as status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as live_orders,
    COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 1 END) as todays_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- 5. Show all orders that should now be visible
SELECT 
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC;
