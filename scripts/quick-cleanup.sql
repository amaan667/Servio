-- ========================================
-- QUICK CLEANUP SCRIPT
-- ========================================
-- Simple script to close all active orders and free all tables
-- Use this if you want to reset everything quickly

-- ========================================
-- 1. CLOSE ALL ACTIVE ORDERS
-- ========================================

-- First, see what active orders we have
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

-- Close all active orders
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    updated_at = NOW()
WHERE order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');

-- ========================================
-- 2. FREE ALL TABLES
-- ========================================

-- Close all active table sessions
UPDATE table_sessions 
SET 
    status = 'FREE',
    order_id = NULL,
    closed_at = NOW(),
    updated_at = NOW()
WHERE closed_at IS NULL;

-- Clear all table runtime states
UPDATE table_runtime_state 
SET 
    primary_status = 'FREE',
    order_id = NULL,
    updated_at = NOW();

-- ========================================
-- 3. VERIFICATION
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
    'QUICK CLEANUP COMPLETE' as status,
    NOW() as completed_at;
