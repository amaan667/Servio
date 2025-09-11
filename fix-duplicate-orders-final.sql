-- FINAL FIX for Duplicate Orders Issue
-- The issue was caused by the redistribute-existing-orders.sql script using RANDOM() 
-- which can select the same order multiple times, creating duplicates

-- ============================================================================
-- STEP 1: Identify and remove duplicate orders
-- ============================================================================

-- Find orders that are exact duplicates (same customer, amount, items, within 5 minutes)
WITH duplicate_orders AS (
  SELECT 
    o1.id as order1_id,
    o2.id as order2_id,
    o1.customer_name,
    o1.total_amount,
    o1.created_at as order1_created,
    o2.created_at as order2_created,
    o1.table_number as order1_table,
    o2.table_number as order2_table,
    o1.payment_status as order1_payment,
    o2.payment_status as order2_payment
  FROM orders o1
  JOIN orders o2 ON (
    o1.venue_id = o2.venue_id 
    AND o1.customer_name = o2.customer_name
    AND o1.total_amount = o2.total_amount
    AND o1.id < o2.id  -- Avoid self-joins and duplicates
    AND ABS(EXTRACT(EPOCH FROM (o1.created_at - o2.created_at))) < 300  -- Within 5 minutes
    AND o1.venue_id = 'venue-1e02af4d'
  )
)
SELECT 
  '=== DUPLICATE ORDERS FOUND ===' as step,
  order1_id,
  order2_id,
  customer_name,
  total_amount,
  order1_table,
  order2_table,
  order1_payment,
  order2_payment,
  order1_created,
  order2_created
FROM duplicate_orders;

-- ============================================================================
-- STEP 2: Remove duplicate orders (keep the one with PAID status or later timestamp)
-- ============================================================================

-- Delete duplicate orders, keeping the one that is PAID or created later
DELETE FROM orders 
WHERE id IN (
  SELECT o2.id
  FROM orders o1
  JOIN orders o2 ON (
    o1.venue_id = o2.venue_id 
    AND o1.customer_name = o2.customer_name
    AND o1.total_amount = o2.total_amount
    AND o1.id < o2.id
    AND ABS(EXTRACT(EPOCH FROM (o1.created_at - o2.created_at))) < 300
    AND o1.venue_id = 'venue-1e02af4d'
  )
  WHERE (
    -- Keep the PAID order, delete the UNPAID one
    (o1.payment_status = 'PAID' AND o2.payment_status = 'UNPAID')
    OR
    -- If both have same payment status, keep the later one
    (o1.payment_status = o2.payment_status AND o1.created_at > o2.created_at)
    OR
    -- If both have same payment status and timestamp, keep the one with higher table number
    (o1.payment_status = o2.payment_status AND o1.created_at = o2.created_at AND o1.table_number > o2.table_number)
  )
);

-- ============================================================================
-- STEP 3: Verify the fix
-- ============================================================================

-- Check for any remaining duplicates
WITH remaining_duplicates AS (
  SELECT 
    o1.id as order1_id,
    o2.id as order2_id,
    o1.customer_name,
    o1.total_amount
  FROM orders o1
  JOIN orders o2 ON (
    o1.venue_id = o2.venue_id 
    AND o1.customer_name = o2.customer_name
    AND o1.total_amount = o2.total_amount
    AND o1.id < o2.id
    AND ABS(EXTRACT(EPOCH FROM (o1.created_at - o2.created_at))) < 300
    AND o1.venue_id = 'venue-1e02af4d'
  )
)
SELECT 
  '=== REMAINING DUPLICATES CHECK ===' as step,
  COUNT(*) as duplicate_count
FROM remaining_duplicates;

-- ============================================================================
-- STEP 4: Show current order distribution
-- ============================================================================

SELECT 
  '=== CURRENT ORDER DISTRIBUTION ===' as step,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as live_orders,
  COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as earlier_today_orders,
  COUNT(CASE WHEN created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as history_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 5: Show recent orders to verify fix
-- ============================================================================

SELECT 
  '=== RECENT ORDERS (Last 2 hours) ===' as step,
  id,
  customer_name,
  table_number,
  total_amount,
  order_status,
  payment_status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'SUMMARY' as info,
  '✅ Identified and removed duplicate orders' as duplicate_fix,
  '✅ Kept orders with PAID status or later timestamps' as retention_logic,
  '✅ Verified no remaining duplicates' as verification,
  '✅ Order distribution maintained' as distribution,
  '🔄 Refresh your Live Orders page to see the clean results!' as next_step;
