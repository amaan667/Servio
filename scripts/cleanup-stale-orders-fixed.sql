-- ========================================
-- STALE ORDERS CLEANUP SCRIPT (FIXED)
-- ========================================
-- This script finds and closes orders that have been open for too long
-- and frees up the associated tables

-- ========================================
-- 1. FIND STALE ORDERS (open for more than 4 hours)
-- ========================================

-- First, let's see what stale orders we have
SELECT 
    o.id,
    o.venue_id,
    o.table_number,
    o.table_id,
    o.customer_name,
    o.order_status,
    o.payment_status,
    o.source,
    o.created_at,
    o.updated_at,
    EXTRACT(EPOCH FROM (NOW() - o.created_at))/3600 as hours_open,
    t.label as table_label
FROM orders o
LEFT JOIN tables t ON o.table_id = t.id
WHERE o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
  AND o.created_at < NOW() - INTERVAL '4 hours'
ORDER BY o.created_at ASC;

-- ========================================
-- 2. UPDATE STALE ORDERS TO COMPLETED
-- ========================================

-- Mark all stale orders as completed
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    updated_at = NOW()
WHERE order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
  AND created_at < NOW() - INTERVAL '4 hours';

-- Get count of updated orders
SELECT COUNT(*) as completed_orders_count
FROM orders 
WHERE order_status = 'COMPLETED'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- ========================================
-- 3. CLEAN UP TABLE SESSIONS
-- ========================================

-- Close all active table sessions for tables that had stale orders
-- Method 1: By table_id (direct relationship)
UPDATE table_sessions 
SET 
    status = 'FREE',
    order_id = NULL,
    closed_at = NOW(),
    updated_at = NOW()
WHERE closed_at IS NULL
  AND table_id IN (
    SELECT DISTINCT table_id 
    FROM orders 
    WHERE order_status = 'COMPLETED'
      AND updated_at > NOW() - INTERVAL '1 minute'
      AND table_id IS NOT NULL
  );

-- Method 2: By table_number (through tables table)
UPDATE table_sessions 
SET 
    status = 'FREE',
    order_id = NULL,
    closed_at = NOW(),
    updated_at = NOW()
WHERE closed_at IS NULL
  AND table_id IN (
    SELECT DISTINCT t.id
    FROM tables t
    JOIN orders o ON t.table_number = o.table_number
    WHERE o.order_status = 'COMPLETED'
      AND o.updated_at > NOW() - INTERVAL '1 minute'
      AND o.table_number IS NOT NULL
  );

-- Get count of closed sessions
SELECT COUNT(*) as closed_sessions_count
FROM table_sessions 
WHERE status = 'FREE'
  AND closed_at > NOW() - INTERVAL '1 minute';

-- ========================================
-- 4. CLEAN UP TABLE RUNTIME STATE
-- ========================================

-- Clear table runtime state for tables that had stale orders
-- Method 1: By table_id
UPDATE table_runtime_state 
SET 
    primary_status = 'FREE',
    order_id = NULL,
    updated_at = NOW()
WHERE table_id IN (
    SELECT DISTINCT table_id 
    FROM orders 
    WHERE order_status = 'COMPLETED'
      AND updated_at > NOW() - INTERVAL '1 minute'
      AND table_id IS NOT NULL
  );

-- Method 2: By table label for table_number based orders
UPDATE table_runtime_state 
SET 
    primary_status = 'FREE',
    order_id = NULL,
    updated_at = NOW()
WHERE label IN (
    SELECT DISTINCT 'Table ' || table_number
    FROM orders 
    WHERE order_status = 'COMPLETED'
      AND updated_at > NOW() - INTERVAL '1 minute'
      AND table_number IS NOT NULL
  );

-- Get count of cleared runtime states
SELECT COUNT(*) as cleared_runtime_states_count
FROM table_runtime_state 
WHERE primary_status = 'FREE'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- ========================================
-- 5. VERIFICATION QUERIES
-- ========================================

-- Check remaining active orders (should be none older than 4 hours)
SELECT 
    COUNT(*) as remaining_stale_orders,
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as oldest_hours
FROM orders 
WHERE order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
  AND created_at < NOW() - INTERVAL '4 hours';

-- Check table status after cleanup
SELECT 
    t.label,
    t.id,
    ts.status as session_status,
    trs.primary_status as runtime_status,
    ts.closed_at,
    COUNT(o.id) as active_orders
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
LEFT JOIN table_runtime_state trs ON t.id = trs.table_id
LEFT JOIN orders o ON (o.table_id = t.id OR o.table_number = t.table_number) 
    AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
GROUP BY t.id, t.label, ts.status, trs.primary_status, ts.closed_at
ORDER BY t.label;

-- ========================================
-- 6. SUMMARY REPORT
-- ========================================

-- Final summary
SELECT 
    'CLEANUP SUMMARY' as report_type,
    (SELECT COUNT(*) FROM orders WHERE order_status = 'COMPLETED' AND updated_at > NOW() - INTERVAL '1 minute') as orders_completed,
    (SELECT COUNT(*) FROM table_sessions WHERE status = 'FREE' AND closed_at > NOW() - INTERVAL '1 minute') as sessions_closed,
    (SELECT COUNT(*) FROM table_runtime_state WHERE primary_status = 'FREE' AND updated_at > NOW() - INTERVAL '1 minute') as runtime_states_cleared,
    NOW() as cleanup_timestamp;
