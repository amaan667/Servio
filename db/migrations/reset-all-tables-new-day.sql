-- RESET ALL TABLES FOR NEW DAY: Remove all tables created yesterday, reset everything to 0

-- ============================================================================
-- STEP 1: Check current table state
-- ============================================================================

SELECT 
    '=== CURRENT TABLE STATE ===' as info;

-- Show all tables for this venue
SELECT 
    'All tables for venue:' as info,
    id,
    label,
    seat_count,
    is_active,
    created_at,
    DATE(created_at) as "Created Date"
FROM tables 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC;

-- Show all table sessions
SELECT 
    'All table sessions:' as info,
    id,
    table_id,
    status,
    opened_at,
    closed_at,
    DATE(opened_at) as "Opened Date"
FROM table_sessions 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY opened_at DESC;

-- ============================================================================
-- STEP 2: Remove ALL tables and sessions for new day
-- ============================================================================

SELECT 
    '=== REMOVING ALL TABLES FOR NEW DAY ===' as info;

-- First, delete all table sessions for this venue
DELETE FROM table_sessions 
WHERE venue_id = 'venue-1e02af4d';

-- Then, delete all tables for this venue
DELETE FROM tables 
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 3: Update dashboard_counts function to handle empty tables
-- ============================================================================

SELECT 
    '=== UPDATING DASHBOARD COUNTS FUNCTION ===' as info;

-- Drop and recreate the function to handle empty tables
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
    
    -- Count tables set up (ALL active tables - should be 0 after reset)
    SELECT COUNT(*) INTO tables_set_up_val
    FROM tables 
    WHERE venue_id = p_venue_id
      AND is_active = true;
    
    -- Count tables in use (active table sessions - should be 0 after reset)
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
-- STEP 4: Test the function after reset
-- ============================================================================

SELECT 
    '=== TESTING FUNCTION AFTER RESET ===' as info;

-- Test the function
SELECT 
    'Function result after reset:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up (should be 0)",
    tables_in_use as "Tables In Use (should be 0)"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 5: Verify tables are gone
-- ============================================================================

SELECT 
    '=== VERIFICATION ===' as info;

-- Check that all tables are gone
SELECT 
    'Remaining tables (should be 0):' as info,
    COUNT(*) as table_count
FROM tables 
WHERE venue_id = 'venue-1e02af4d';

-- Check that all table sessions are gone
SELECT 
    'Remaining table sessions (should be 0):' as info,
    COUNT(*) as session_count
FROM table_sessions 
WHERE venue_id = 'venue-1e02af4d';
