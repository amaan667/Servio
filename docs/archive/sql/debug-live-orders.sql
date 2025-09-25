-- Debug Live Orders Issue
-- This script helps identify why orders aren't showing up in live orders

-- 1. Check all orders in the database
SELECT 
    'ALL ORDERS' as category,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders;

-- 2. Check orders by venue
SELECT 
    'ORDERS BY VENUE' as category,
    venue_id,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders 
GROUP BY venue_id;

-- 3. Check orders by status
SELECT 
    'ORDERS BY STATUS' as category,
    order_status,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders 
GROUP BY order_status
ORDER BY count DESC;

-- 4. Check orders by payment status
SELECT 
    'ORDERS BY PAYMENT STATUS' as category,
    payment_status,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders 
GROUP BY payment_status
ORDER BY count DESC;

-- 5. Check recent orders (last 24 hours)
SELECT 
    'RECENT ORDERS (24H)' as category,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- 6. Check orders from today (2024-09-09)
SELECT 
    'TODAY ORDERS (2024-09-09)' as category,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders 
WHERE created_at >= '2024-09-09 00:00:00' 
  AND created_at < '2024-09-10 00:00:00';

-- 7. Check orders from last 30 minutes
SELECT 
    'LAST 30 MINUTES' as category,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders 
WHERE created_at >= NOW() - INTERVAL '30 minutes';

-- 8. Detailed view of recent orders
SELECT 
    'DETAILED RECENT ORDERS' as category,
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
WHERE created_at >= NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 9. Check if there are any orders that should be in live orders
SELECT 
    'POTENTIAL LIVE ORDERS' as category,
    id,
    venue_id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders 
WHERE created_at >= NOW() - INTERVAL '30 minutes'
  AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
ORDER BY created_at DESC;

-- 10. Check table sessions to see if they're being updated
SELECT 
    'TABLE SESSIONS' as category,
    ts.id,
    ts.table_id,
    ts.status,
    ts.order_id,
    ts.opened_at,
    ts.closed_at,
    t.label as table_label,
    t.venue_id
FROM table_sessions ts
LEFT JOIN tables t ON ts.table_id = t.id
WHERE ts.opened_at >= NOW() - INTERVAL '2 hours'
ORDER BY ts.opened_at DESC
LIMIT 20;
