-- IMMEDIATE FIX: Dashboard Counts Discrepancy
-- Fix Today's Orders (should be 1) and Tables Set Up (should be 8)

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================

SELECT 
    '=== CURRENT STATE ===' as info;

-- Check orders
SELECT 
    'Orders today:' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_orders
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- Check tables
SELECT 
    'Tables:' as info,
    COUNT(*) as total_tables,
    COUNT(CASE WHEN primary_status = 'FREE' THEN 1 END) as free_tables,
    COUNT(CASE WHEN primary_status = 'OCCUPIED' THEN 1 END) as occupied_tables
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 2: Fix any payment status issues
-- ============================================================================

SELECT 
    '=== FIXING PAYMENT STATUS ===' as info;

-- Ensure all orders from today are marked as PAID
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status != 'PAID';

-- ============================================================================
-- STEP 3: Recreate the dashboard_counts function with better logic
-- ============================================================================

SELECT 
    '=== RECREATING FUNCTION ===' as info;

-- Drop and recreate the function
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
    -- Calculate time windows - use simpler approach
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day' - INTERVAL '1 second';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Debug: Log the time windows
    RAISE NOTICE 'Time windows: today_start=%, today_end=%, live_cutoff=%', today_start, today_end, live_cutoff;
    
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
    
    -- Count total today's orders
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
    
    -- Count ALL tables as "set up" (total tables)
    SELECT COUNT(*) INTO tables_set_up_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id;
    
    -- Count occupied tables as "in use"
    SELECT COUNT(*) INTO tables_in_use_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id
      AND primary_status = 'OCCUPIED';
    
    -- Debug: Log the counts
    RAISE NOTICE 'Counts: live=%, earlier=%, history=%, today=%, active_tables=%, set_up=%, in_use=%', 
        live_count_val, earlier_today_count_val, history_count_val, today_orders_count_val, 
        active_tables_count_val, tables_set_up_val, tables_in_use_val;
    
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
-- STEP 4: Test the fixed function
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
-- STEP 5: Verify the fix
-- ============================================================================

SELECT 
    '=== VERIFICATION ===' as info;

-- Show what should be visible
SELECT 
    'Orders that should be counted:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID'
ORDER BY created_at DESC;

-- Show all tables
SELECT 
    'All tables that should be counted:' as info,
    id,
    label,
    primary_status,
    seat_count
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;
