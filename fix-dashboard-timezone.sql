-- FIX DASHBOARD TIMEZONE: Fix timezone calculation in dashboard_counts function
-- The issue is that orders from yesterday (Sept 9) might be counted as today (Sept 10) due to timezone issues

-- ============================================================================
-- STEP 1: Check current function behavior
-- ============================================================================

SELECT 
    '=== CURRENT FUNCTION BEHAVIOR ===' as info;

-- Test the current function
SELECT 
    'Current function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today", 
    history_count as "History",
    today_orders_count as "Today's Orders Total"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 2: Check what orders exist and their dates
-- ============================================================================

SELECT 
    '=== ORDER DATE ANALYSIS ===' as info;

-- Show all orders with their dates in different timezones
SELECT 
    'Order date analysis:' as info,
    id,
    created_at as "UTC Timestamp",
    created_at AT TIME ZONE 'Europe/London' as "London Timestamp",
    DATE(created_at) as "UTC Date",
    DATE(created_at AT TIME ZONE 'Europe/London') as "London Date",
    payment_status,
    order_status
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 3: Create improved dashboard_counts function
-- ============================================================================

SELECT 
    '=== CREATING IMPROVED FUNCTION ===' as info;

-- Drop the existing function
DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

-- Create improved dashboard_counts function with better timezone handling
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
    -- Calculate time windows more explicitly
    -- Get current time in the specified timezone
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window)
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count earlier today orders (today but before live window)
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count history orders (before today)
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status = 'PAID';
    
    -- Count total today's orders (sum of live + earlier today)
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count active tables (tables with current orders)
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID'
      AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING');
    
    -- Count tables set up (from table_runtime_state) - FREE tables
    SELECT COUNT(*) INTO tables_set_up_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id
      AND primary_status = 'FREE';
    
    -- Count tables in use (from table_runtime_state) - OCCUPIED tables
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
-- STEP 4: Test the improved function
-- ============================================================================

SELECT 
    '=== TESTING IMPROVED FUNCTION ===' as info;

-- Test the improved function
SELECT 
    'Improved function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History", 
    today_orders_count as "Today's Orders Total"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 5: Show time window details
-- ============================================================================

SELECT 
    '=== TIME WINDOW DETAILS ===' as info;

-- Show the exact time windows being used
SELECT 
    'Time window details:' as info,
    NOW() as "Current UTC Time",
    NOW() AT TIME ZONE 'Europe/London' as "Current London Time",
    date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' as "Today Start (London)",
    (date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' + INTERVAL '1 day') as "Today End (London)",
    NOW() - INTERVAL '30 minutes' as "Live Cutoff (30 min ago)";
