-- Fix Today's Orders Count - Force it to show the correct number
-- The live orders page shows 1 order correctly, but dashboard shows 0

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================

SELECT 
    '=== CURRENT STATE ===' as info;

-- Check what the function currently returns
SELECT 
    'Current function result:' as info,
    today_orders_count as "Today's Orders"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- Check actual orders
SELECT 
    'Actual orders today:' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_orders
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- ============================================================================
-- STEP 2: Fix the function with simpler, more reliable logic
-- ============================================================================

SELECT 
    '=== FIXING FUNCTION ===' as info;

-- Drop and recreate with simpler logic
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
    today_start timestamptz;
    today_end timestamptz;
    live_cutoff timestamptz;
    live_count_val integer;
    earlier_today_count_val integer;
    history_count_val integer;
    today_orders_count_val integer;
    active_tables_count_val integer;
    tables_set_up_val integer;
    tables_in_use_val integer;
BEGIN
    -- Use simpler timezone calculation
    today_start := (CURRENT_DATE AT TIME ZONE p_tz) AT TIME ZONE 'UTC';
    today_end := today_start + INTERVAL '1 day' - INTERVAL '1 second';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window)
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status = 'PAID';
    
    -- Count earlier today orders (today but before live window)
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status = 'PAID';
    
    -- Count history orders (before today)
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status = 'PAID';
    
    -- Count total today's orders - THIS IS THE KEY FIX
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status = 'PAID';
    
    -- Count active tables (tables with current orders)
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
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
-- STEP 3: Test the fixed function
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
-- STEP 4: Verify the fix
-- ============================================================================

SELECT 
    '=== VERIFICATION ===' as info;

-- Show the order that should be counted
SELECT 
    'Order that should be counted:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time,
    created_at as full_timestamp
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID'
ORDER BY created_at DESC;

-- Show time windows for debugging
SELECT 
    'Time windows used:' as info,
    (CURRENT_DATE AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC' as "Today Start UTC",
    (CURRENT_DATE AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC' + INTERVAL '1 day' - INTERVAL '1 second' as "Today End UTC",
    NOW() - INTERVAL '30 minutes' as "Live Cutoff";
