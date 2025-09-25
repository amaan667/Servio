-- Fix Live Orders Issue
-- This script helps fix orders that aren't showing up in live orders

-- 1. Update orders created in 2025 to 2024 (fix system date issue)
UPDATE orders 
SET created_at = created_at - INTERVAL '1 year'
WHERE created_at >= '2025-01-01' 
  AND created_at < '2026-01-01';

-- 2. Update orders that have NULL or invalid order_status
UPDATE orders 
SET order_status = 'PLACED'
WHERE order_status IS NULL 
   OR order_status = '';

-- 3. Update orders that have NULL or invalid payment_status
UPDATE orders 
SET payment_status = 'UNPAID'
WHERE payment_status IS NULL 
   OR payment_status = '';

-- 4. Ensure all orders have proper timestamps
UPDATE orders 
SET updated_at = created_at
WHERE updated_at IS NULL 
   OR updated_at < created_at;

-- 5. Create table sessions for orders that don't have them
INSERT INTO table_sessions (venue_id, table_id, status, order_id, opened_at, created_at, updated_at)
SELECT DISTINCT
    o.venue_id,
    t.id as table_id,
    'OCCUPIED' as status,
    o.id as order_id,
    o.created_at as opened_at,
    NOW() as created_at,
    NOW() as updated_at
FROM orders o
LEFT JOIN tables t ON t.venue_id = o.venue_id AND t.label = o.table_number::text
LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.order_id = o.id
WHERE o.table_number IS NOT NULL
  AND t.id IS NOT NULL
  AND ts.id IS NULL
  AND o.created_at >= NOW() - INTERVAL '24 hours';

-- 6. Update table sessions to OCCUPIED for recent orders
UPDATE table_sessions ts
SET 
    status = 'OCCUPIED',
    order_id = o.id,
    updated_at = NOW()
FROM orders o
JOIN tables t ON t.venue_id = o.venue_id AND t.label = o.table_number::text
WHERE ts.table_id = t.id
  AND ts.order_id IS NULL
  AND o.created_at >= NOW() - INTERVAL '24 hours'
  AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');

-- 7. Show summary of fixes
SELECT 
    'FIXES APPLIED' as category,
    'Orders updated to 2024' as fix_type,
    COUNT(*) as count
FROM orders 
WHERE created_at >= '2024-01-01' 
  AND created_at < '2025-01-01';

SELECT 
    'FIXES APPLIED' as category,
    'Orders with PLACED status' as fix_type,
    COUNT(*) as count
FROM orders 
WHERE order_status = 'PLACED';

SELECT 
    'FIXES APPLIED' as category,
    'Table sessions created' as fix_type,
    COUNT(*) as count
FROM table_sessions 
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- 8. Show current live orders after fixes
SELECT 
    'CURRENT LIVE ORDERS' as category,
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
WHERE o.created_at >= NOW() - INTERVAL '30 minutes'
  AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
ORDER BY o.created_at DESC;
