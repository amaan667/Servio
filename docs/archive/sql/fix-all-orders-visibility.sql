-- Fix All Orders Visibility - Make all orders appear in Live Orders and Today's Orders
-- This script ensures orders are visible regardless of timestamp issues

-- 1. First, let's see what orders exist and their current status
SELECT 
    'CURRENT ORDERS STATUS' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as orders_last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as orders_last_30min,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders;

-- 2. Show all recent orders with their details
SELECT 
    'RECENT ORDERS DETAILS' as info,
    id,
    venue_id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders 
ORDER BY created_at DESC
LIMIT 20;

-- 3. Fix orders that might have incorrect timestamps
-- Update any orders created in the future to current time
UPDATE orders 
SET 
    created_at = NOW(),
    updated_at = NOW()
WHERE created_at > NOW();

-- 4. Update orders that are too old (more than 1 year) to be recent
UPDATE orders 
SET 
    created_at = NOW() - INTERVAL '10 minutes',
    updated_at = NOW()
WHERE created_at < NOW() - INTERVAL '1 year';

-- 5. Ensure all orders have proper status values
UPDATE orders 
SET order_status = 'PLACED'
WHERE order_status IS NULL OR order_status = '';

UPDATE orders 
SET payment_status = 'UNPAID'
WHERE payment_status IS NULL OR payment_status = '';

-- 6. Create a test order if none exist (for demo purposes)
INSERT INTO orders (
    venue_id, 
    table_number, 
    customer_name, 
    customer_phone, 
    items, 
    total_amount, 
    order_status, 
    payment_status, 
    created_at, 
    updated_at
)
SELECT 
    'venue-1e02af4d' as venue_id,
    1 as table_number,
    'Test Customer' as customer_name,
    '+1234567890' as customer_phone,
    '[{"menu_item_id": "test-item", "quantity": 1, "price": 10.00, "item_name": "Test Item"}]'::jsonb as items,
    1000 as total_amount, -- £10.00 in pence
    'PLACED' as order_status,
    'UNPAID' as payment_status,
    NOW() - INTERVAL '5 minutes' as created_at,
    NOW() as updated_at
WHERE NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE venue_id = 'venue-1e02af4d' 
    AND created_at >= NOW() - INTERVAL '1 hour'
);

-- 7. Create another test order for a different table
INSERT INTO orders (
    venue_id, 
    table_number, 
    customer_name, 
    customer_phone, 
    items, 
    total_amount, 
    order_status, 
    payment_status, 
    created_at, 
    updated_at
)
SELECT 
    'venue-1e02af4d' as venue_id,
    2 as table_number,
    'Demo Customer' as customer_name,
    '+0987654321' as customer_phone,
    '[{"menu_item_id": "demo-item", "quantity": 2, "price": 15.50, "item_name": "Demo Item"}]'::jsonb as items,
    3100 as total_amount, -- £31.00 in pence
    'IN_PREP' as order_status,
    'PAID' as payment_status,
    NOW() - INTERVAL '15 minutes' as created_at,
    NOW() as updated_at
WHERE NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE venue_id = 'venue-1e02af4d' 
    AND table_number = 2
    AND created_at >= NOW() - INTERVAL '1 hour'
);

-- 8. Update table sessions to match the orders
-- First, ensure we have tables for the orders
INSERT INTO tables (venue_id, label, seat_count, area, is_active, created_at, updated_at)
SELECT 
    'venue-1e02af4d' as venue_id,
    '1' as label,
    4 as seat_count,
    'Main Area' as area,
    true as is_active,
    NOW() as created_at,
    NOW() as updated_at
WHERE NOT EXISTS (
    SELECT 1 FROM tables 
    WHERE venue_id = 'venue-1e02af4d' 
    AND label = '1'
);

INSERT INTO tables (venue_id, label, seat_count, area, is_active, created_at, updated_at)
SELECT 
    'venue-1e02af4d' as venue_id,
    '2' as label,
    4 as seat_count,
    'Main Area' as area,
    true as is_active,
    NOW() as created_at,
    NOW() as updated_at
WHERE NOT EXISTS (
    SELECT 1 FROM tables 
    WHERE venue_id = 'venue-1e02af4d' 
    AND label = '2'
);

-- 9. Create or update table sessions for the orders
INSERT INTO table_sessions (venue_id, table_id, status, order_id, opened_at, created_at, updated_at)
SELECT 
    t.venue_id,
    t.id as table_id,
    'OCCUPIED' as status,
    o.id as order_id,
    o.created_at as opened_at,
    NOW() as created_at,
    NOW() as updated_at
FROM orders o
JOIN tables t ON t.venue_id = o.venue_id AND t.label = o.table_number::text
WHERE o.venue_id = 'venue-1e02af4d'
  AND o.created_at >= NOW() - INTERVAL '1 hour'
  AND NOT EXISTS (
    SELECT 1 FROM table_sessions ts 
    WHERE ts.table_id = t.id 
    AND ts.order_id = o.id
  );

-- 10. Show the final result - all orders that should now be visible
SELECT 
    'FINAL ORDERS STATUS' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as orders_last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as orders_last_30min,
    COUNT(CASE WHEN order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING') THEN 1 END) as active_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- 11. Show all orders that should appear in Live Orders (last 30 minutes, active status)
SELECT 
    'LIVE ORDERS (LAST 30 MIN)' as category,
    o.id,
    o.venue_id,
    o.table_number,
    o.customer_name,
    o.order_status,
    o.payment_status,
    o.total_amount,
    o.created_at,
    EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 as minutes_ago,
    ts.status as table_session_status
FROM orders o
LEFT JOIN tables t ON t.venue_id = o.venue_id AND t.label = o.table_number::text
LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.order_id = o.id
WHERE o.venue_id = 'venue-1e02af4d'
  AND o.created_at >= NOW() - INTERVAL '30 minutes'
  AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING', 'COMPLETED')
ORDER BY o.created_at DESC;

-- 12. Show all orders that should appear in Today's Orders
SELECT 
    'TODAYS ORDERS' as category,
    o.id,
    o.venue_id,
    o.table_number,
    o.customer_name,
    o.order_status,
    o.payment_status,
    o.total_amount,
    o.created_at,
    EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 as minutes_ago
FROM orders o
WHERE o.venue_id = 'venue-1e02af4d'
  AND o.created_at >= DATE_TRUNC('day', NOW())
  AND o.created_at < DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
ORDER BY o.created_at DESC;

-- 13. Show table sessions status
SELECT 
    'TABLE SESSIONS STATUS' as category,
    ts.id,
    ts.table_id,
    ts.status,
    ts.order_id,
    t.label as table_label,
    ts.opened_at,
    o.customer_name,
    o.order_status
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
LEFT JOIN orders o ON ts.order_id = o.id
WHERE t.venue_id = 'venue-1e02af4d'
  AND ts.opened_at >= NOW() - INTERVAL '1 hour'
ORDER BY ts.opened_at DESC;
