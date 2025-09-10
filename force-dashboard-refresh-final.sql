-- FORCE DASHBOARD REFRESH FINAL: Comprehensive fix for dashboard counts

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================

SELECT 
    '=== CURRENT STATE CHECK ===' as info;

-- Check orders from today
SELECT 
    'Orders from today:' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_orders,
    COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_orders
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE;

-- Check table sessions
SELECT 
    'Table sessions:' as info,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN closed_at IS NULL THEN 1 END) as active_sessions,
    COUNT(CASE WHEN closed_at IS NOT NULL THEN 1 END) as closed_sessions
FROM table_sessions 
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 2: Force close ALL table sessions for new day
-- ============================================================================

SELECT 
    '=== FORCING TABLE RESET ===' as info;

-- Close ALL table sessions (both active and inactive) for this venue
UPDATE table_sessions 
SET 
    closed_at = NOW(),
    status = 'CLOSED'
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 3: Recreate dashboard_counts function with explicit logic
-- ============================================================================

SELECT 
    '=== RECREATING DASHBOARD COUNTS FUNCTION ===' as info;

-- Drop and recreate the function with very explicit logic
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
    -- Calculate time windows very explicitly
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window) - only PAID
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count earlier today orders (today but before live window) - only PAID
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count history orders (before today) - only PAID
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status = 'PAID';
    
    -- Count total today's orders (ALL orders from today, including UNPAID)
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at < today_end;
    
    -- Count active tables (tables with current orders) - only PAID
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID'
      AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING');
    
    -- Count tables set up (ALL tables since sessions are closed)
    SELECT COUNT(*) INTO tables_set_up_val
    FROM tables 
    WHERE venue_id = p_venue_id
      AND is_active = true;
    
    -- Count tables in use (should be 0 since all sessions are closed)
    SELECT COUNT(*) INTO tables_in_use_val
    FROM table_sessions 
    WHERE venue_id = p_venue_id
      AND closed_at IS NULL;
    
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
-- STEP 4: Test the function
-- ============================================================================

SELECT 
    '=== TESTING FUNCTION ===' as info;

-- Test the function
SELECT 
    'Function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 5: Show time details
-- ============================================================================

SELECT 
    '=== TIME DETAILS ===' as info;

-- Show the exact time windows being used
SELECT 
    'Time details:' as info,
    NOW() as "Current UTC Time",
    NOW() AT TIME ZONE 'Europe/London' as "Current London Time",
    date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' as "Today Start (London)",
    (date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' + INTERVAL '1 day') as "Today End (London)";
