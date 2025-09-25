-- SIMPLE FIX: Today's Orders Count
-- The count is still 0 even after payment status fix, so let's check the actual data

-- ============================================================================
-- STEP 1: Check what orders actually exist
-- ============================================================================

SELECT 
    '=== WHAT ORDERS EXIST? ===' as info;

-- Show ALL orders for this venue
SELECT 
    'All orders for venue:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    created_at::date as "Order Date",
    created_at::time as "Order Time"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Check what date the order is actually on
-- ============================================================================

SELECT 
    '=== ORDER DATE ANALYSIS ===' as info;

-- Check the exact date of the order
SELECT 
    'Order date analysis:' as info,
    id,
    created_at as "Full Timestamp",
    created_at::date as "Order Date (UTC)",
    created_at AT TIME ZONE 'Europe/London' as "Order Date (London)",
    DATE(created_at AT TIME ZONE 'Europe/London') as "Order Date London",
    CURRENT_DATE as "Today's Date",
    CASE 
        WHEN DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE THEN 'TODAY'
        WHEN DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE - INTERVAL '1 day' THEN 'YESTERDAY'
        WHEN DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE + INTERVAL '1 day' THEN 'TOMORROW'
        ELSE 'OTHER: ' || DATE(created_at AT TIME ZONE 'Europe/London')::text
    END as "Date Status"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 3: Simple count without date restrictions
-- ============================================================================

SELECT 
    '=== SIMPLE COUNTS ===' as info;

-- Count all orders for this venue
SELECT 
    'Total orders for venue:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d';

-- Count orders with PAID status
SELECT 
    'Orders with PAID status:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID';

-- Count orders from the last 24 hours
SELECT 
    'Orders from last 24 hours:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND payment_status = 'PAID';

-- ============================================================================
-- STEP 4: Create a simple function that just counts recent orders
-- ============================================================================

SELECT 
    '=== CREATING SIMPLE FUNCTION ===' as info;

-- Drop and recreate with the simplest possible logic
DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

CREATE OR REPLACE FUNCTION dashboard_counts(
    p_venue_id text,
    p_tz text DEFAULT 'Europe/London',
    p_live_window_mins integer DEFAULT 30
)
RETURNS TABLE(
    live_count integer,
    earlier_today_count integer,
    history_count integer,
    today_orders_count integer,
    active_tables_count integer,
    tables_set_up integer,
    tables_in_use integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    live_cutoff timestamptz;
    live_count_val integer;
    earlier_today_count_val integer;
    history_count_val integer;
    today_orders_count_val integer;
    active_tables_count_val integer;
    tables_set_up_val integer;
    tables_in_use_val integer;
BEGIN
    -- Use simple time-based logic instead of date comparisons
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (last 30 minutes)
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND payment_status = 'PAID';
    
    -- Count earlier today orders (last 24 hours but more than 30 minutes ago)
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND created_at < live_cutoff
      AND payment_status = 'PAID';
    
    -- Count history orders (older than 24 hours)
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < NOW() - INTERVAL '24 hours'
      AND payment_status = 'PAID';
    
    -- Count total today's orders (last 24 hours)
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND payment_status = 'PAID';
    
    -- Count active tables (tables with current orders)
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND payment_status = 'PAID'
      AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING');
    
    -- Count ALL tables as "set up"
    SELECT COUNT(*) INTO tables_set_up_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id;
    
    -- Count occupied tables as "in use"
    SELECT COUNT(*) INTO tables_in_use_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id
      AND primary_status = 'OCCUPIED';
    
    -- Return the results
    RETURN QUERY SELECT 
        live_count_val,
        earlier_today_count_val,
        history_count_val,
        today_orders_count_val,
        active_tables_count_val,
        tables_set_up_val,
        tables_in_use_val;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO anon;

-- ============================================================================
-- STEP 5: Test the new simple function
-- ============================================================================

SELECT 
    '=== TESTING NEW SIMPLE FUNCTION ===' as info;

-- Test the function
SELECT 
    'New function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 6: Manual verification
-- ============================================================================

SELECT 
    '=== MANUAL VERIFICATION ===' as info;

-- Manual count using the same logic as the function
SELECT 
    'Manual count - last 24 hours:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND payment_status = 'PAID';

-- Show the order that should be counted
SELECT 
    'Order that should be counted:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    created_at,
    NOW() - created_at as "Time Since Order"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND payment_status = 'PAID'
ORDER BY created_at DESC;
