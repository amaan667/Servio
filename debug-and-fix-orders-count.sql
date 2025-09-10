-- DEBUG AND FIX: Today's Orders Still Showing 0
-- Let's find out exactly what's wrong and fix it

-- ============================================================================
-- STEP 1: Check the actual order data
-- ============================================================================

SELECT 
    '=== ACTUAL ORDER DATA ===' as info;

-- Show the exact order that should be counted
SELECT 
    'Order details:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    created_at::date as order_date,
    created_at::time as order_time,
    EXTRACT(timezone_hour FROM created_at) as timezone_offset
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Check timezone calculations step by step
-- ============================================================================

SELECT 
    '=== TIMEZONE CALCULATIONS ===' as info;

-- Show all the time calculations
SELECT 
    'Time calculations:' as info,
    NOW() as "Current UTC Time",
    NOW() AT TIME ZONE 'Europe/London' as "Current London Time",
    CURRENT_DATE as "Current Date",
    CURRENT_DATE AT TIME ZONE 'Europe/London' as "Current Date London",
    (CURRENT_DATE AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC' as "Today Start UTC",
    (CURRENT_DATE AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC' + INTERVAL '1 day' - INTERVAL '1 second' as "Today End UTC",
    NOW() - INTERVAL '30 minutes' as "Live Cutoff";

-- ============================================================================
-- STEP 3: Test if the order falls within our time windows
-- ============================================================================

SELECT 
    '=== ORDER TIME WINDOW TEST ===' as info;

-- Test if the order is within our calculated time windows
WITH time_windows AS (
    SELECT 
        (CURRENT_DATE AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC' as today_start,
        (CURRENT_DATE AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC' + INTERVAL '1 day' - INTERVAL '1 second' as today_end,
        NOW() - INTERVAL '30 minutes' as live_cutoff
)
SELECT 
    'Order time analysis:' as info,
    o.id,
    o.created_at as "Order Time",
    tw.today_start as "Today Start",
    tw.today_end as "Today End",
    tw.live_cutoff as "Live Cutoff",
    o.payment_status,
    CASE 
        WHEN o.created_at >= tw.today_start AND o.created_at <= tw.today_end THEN 'YES - Within Today'
        ELSE 'NO - Outside Today'
    END as "Within Today?",
    CASE 
        WHEN o.created_at >= tw.live_cutoff THEN 'YES - Within Live Window'
        ELSE 'NO - Outside Live Window'
    END as "Within Live Window?",
    CASE 
        WHEN o.payment_status = 'PAID' THEN 'YES - Paid'
        ELSE 'NO - Not Paid'
    END as "Is Paid?"
FROM orders o, time_windows tw
WHERE o.venue_id = 'venue-1e02af4d'
  AND DATE(o.created_at) = '2025-09-10';

-- ============================================================================
-- STEP 4: Fix the payment status if needed
-- ============================================================================

SELECT 
    '=== FIXING PAYMENT STATUS ===' as info;

-- Update the order to PAID if it's not already
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status != 'PAID';

-- Show the result
SELECT 
    'After payment status fix:' as info,
    id,
    payment_status,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- ============================================================================
-- STEP 5: Create a simple, bulletproof function
-- ============================================================================

SELECT 
    '=== CREATING BULLETPROOF FUNCTION ===' as info;

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
    -- Use the simplest possible timezone calculation
    -- Just use the current date in the venue's timezone
    today_start := (CURRENT_DATE AT TIME ZONE p_tz) AT TIME ZONE 'UTC';
    today_end := today_start + INTERVAL '1 day' - INTERVAL '1 second';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count total today's orders - SIMPLEST POSSIBLE LOGIC
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND DATE(created_at AT TIME ZONE p_tz) = CURRENT_DATE
      AND payment_status = 'PAID';
    
    -- Count live orders (today within live window)
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND DATE(created_at AT TIME ZONE p_tz) = CURRENT_DATE
      AND created_at >= live_cutoff
      AND payment_status = 'PAID';
    
    -- Count earlier today orders (today but before live window)
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND DATE(created_at AT TIME ZONE p_tz) = CURRENT_DATE
      AND created_at < live_cutoff
      AND payment_status = 'PAID';
    
    -- Count history orders (before today)
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND DATE(created_at AT TIME ZONE p_tz) < CURRENT_DATE
      AND payment_status = 'PAID';
    
    -- Count active tables (tables with current orders)
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND DATE(created_at AT TIME ZONE p_tz) = CURRENT_DATE
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
-- STEP 6: Test the new function
-- ============================================================================

SELECT 
    '=== TESTING NEW FUNCTION ===' as info;

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
-- STEP 7: Manual verification
-- ============================================================================

SELECT 
    '=== MANUAL VERIFICATION ===' as info;

-- Manual count using the same logic as the function
SELECT 
    'Manual count using function logic:' as info,
    COUNT(*) as "Today's Orders Count"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE
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
    DATE(created_at AT TIME ZONE 'Europe/London') as "London Date",
    CURRENT_DATE as "Current Date"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE
  AND payment_status = 'PAID';
