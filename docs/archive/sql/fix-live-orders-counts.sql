-- FIX LIVE ORDERS COUNTS: Earlier Today should be 1, not 8
-- The live orders page is showing incorrect counts because of timezone/date logic issues

-- ============================================================================
-- STEP 1: Check what orders actually exist and their timestamps
-- ============================================================================

SELECT 
    '=== ACTUAL ORDER DATA ===' as info;

-- Show all orders with detailed timestamp info
SELECT 
    'All orders with timestamps:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    created_at::date as "Order Date",
    created_at::time as "Order Time",
    NOW() - created_at as "Time Since Order",
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as "Hours Since Order"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Check what the current function returns
-- ============================================================================

SELECT 
    '=== CURRENT FUNCTION RESULT ===' as info;

-- Test the current function
SELECT 
    'Current function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 3: Manual calculation to see what it should be
-- ============================================================================

SELECT 
    '=== MANUAL CALCULATION ===' as info;

-- Manual calculation using 24-hour logic
WITH order_analysis AS (
    SELECT 
        id,
        created_at,
        payment_status,
        NOW() - created_at as time_since_order,
        CASE 
            WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE'
            WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 'EARLIER_TODAY'
            ELSE 'HISTORY'
        END as category
    FROM orders 
    WHERE venue_id = 'venue-1e02af4d'
      AND payment_status = 'PAID'
)
SELECT 
    'Manual calculation results:' as info,
    COUNT(CASE WHEN category = 'LIVE' THEN 1 END) as "Live Orders",
    COUNT(CASE WHEN category = 'EARLIER_TODAY' THEN 1 END) as "Earlier Today",
    COUNT(CASE WHEN category = 'HISTORY' THEN 1 END) as "History",
    COUNT(CASE WHEN category IN ('LIVE', 'EARLIER_TODAY') THEN 1 END) as "Today's Orders Total"
FROM order_analysis;

-- Show which orders fall into which category
SELECT 
    'Order categorization:' as info,
    id,
    customer_name,
    created_at::time as "Order Time",
    NOW() - created_at as "Time Since",
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE'
        WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 'EARLIER_TODAY'
        ELSE 'HISTORY'
    END as "Category"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 4: Fix the function with correct 24-hour logic
-- ============================================================================

SELECT 
    '=== FIXING FUNCTION ===' as info;

-- Drop and recreate with correct 24-hour logic
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
    today_cutoff timestamptz;
    live_count_val integer;
    earlier_today_count_val integer;
    history_count_val integer;
    today_orders_count_val integer;
    active_tables_count_val integer;
    tables_set_up_val integer;
    tables_in_use_val integer;
BEGIN
    -- Use simple time-based logic
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    today_cutoff := NOW() - INTERVAL '24 hours';
    
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
      AND created_at >= today_cutoff
      AND created_at < live_cutoff
      AND payment_status = 'PAID';
    
    -- Count history orders (older than 24 hours)
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_cutoff
      AND payment_status = 'PAID';
    
    -- Count total today's orders (last 24 hours)
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_cutoff
      AND payment_status = 'PAID';
    
    -- Count active tables (tables with current orders)
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_cutoff
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
-- STEP 5: Test the fixed function
-- ============================================================================

SELECT 
    '=== TESTING FIXED FUNCTION ===' as info;

-- Test the function
SELECT 
    'Fixed function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 6: Verify the fix
-- ============================================================================

SELECT 
    '=== VERIFICATION ===' as info;

-- Show the order that should be in "Earlier Today"
SELECT 
    'Order in Earlier Today:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as "Order Time",
    NOW() - created_at as "Time Since Order",
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as "Hours Since Order"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND created_at < NOW() - INTERVAL '30 minutes'
  AND payment_status = 'PAID'
ORDER BY created_at DESC;

-- Show orders that should be in "History"
SELECT 
    'Orders in History:' as info,
    id,
    table_number,
    customer_name,
    created_at::time as "Order Time",
    NOW() - created_at as "Time Since Order",
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as "Hours Since Order"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at < NOW() - INTERVAL '24 hours'
  AND payment_status = 'PAID'
ORDER BY created_at DESC;
