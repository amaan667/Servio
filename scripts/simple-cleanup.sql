-- ========================================
-- SIMPLE STALE ORDERS CLEANUP SCRIPT
-- ========================================
-- This script closes all active orders and frees all tables
-- Use this to clean up existing stale orders

-- ========================================
-- 1. SEE WHAT ACTIVE ORDERS WE HAVE
-- ========================================

SELECT 
    id,
    table_number,
    table_id,
    customer_name,
    order_status,
    payment_status,
    source,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_open
FROM orders 
WHERE order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
ORDER BY created_at ASC;

-- ========================================
-- 2. CLOSE ALL ACTIVE ORDERS
-- ========================================

UPDATE orders 
SET 
    order_status = 'COMPLETED',
    updated_at = NOW()
WHERE order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');

-- ========================================
-- 3. FREE ALL TABLE SESSIONS
-- ========================================

UPDATE table_sessions 
SET 
    status = 'FREE',
    order_id = NULL,
    closed_at = NOW(),
    updated_at = NOW()
WHERE closed_at IS NULL;

-- ========================================
-- 4. CLEAR ALL TABLE RUNTIME STATES
-- ========================================
-- Note: table_runtime_state is a view, so we can't update it directly
-- The table sessions cleanup above should handle this automatically

-- ========================================
-- 5. VERIFICATION
-- ========================================

-- Check that all orders are now completed
SELECT 
    order_status,
    COUNT(*) as count
FROM orders 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY order_status;

-- Check table status
SELECT 
    t.label,
    ts.status as session_status,
    trs.primary_status as runtime_status
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
LEFT JOIN table_runtime_state trs ON t.id = trs.table_id
ORDER BY t.label;

-- Summary
SELECT 
    'CLEANUP COMPLETE' as status,
    NOW() as completed_at;
