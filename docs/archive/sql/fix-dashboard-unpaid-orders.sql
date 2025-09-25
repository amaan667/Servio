-- FIX DASHBOARD UNPAID ORDERS: Include UNPAID orders in today's count
-- The issue is that orders show as UNPAID in Live Orders but dashboard only counts PAID orders

-- ============================================================================
-- STEP 1: Check current order statuses
-- ============================================================================

SELECT 
    '=== CURRENT ORDER STATUSES ===' as info;

-- Show orders from today with their payment status
SELECT 
    'Today\'s orders with payment status:' as info,
    id,
    customer_name,
    table_number,
    total_amount,
    order_status,
    payment_status,
    created_at,
    created_at::time as "Order Time"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Update dashboard_counts function to include UNPAID orders
-- ============================================================================

SELECT 
    '=== UPDATING DASHBOARD COUNTS FUNCTION ===' as info;

-- Drop the existing function
DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

-- Create updated dashboard_counts function that includes UNPAID orders for today's count
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
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window) - only PAID orders for live
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count earlier today orders (today but before live window) - only PAID orders
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status = 'PAID';
    
    -- Count history orders (before today) - only PAID orders
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
      -- Removed payment_status filter to include UNPAID orders
    
    -- Count active tables (tables with current orders) - only PAID orders
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
-- STEP 3: Test the updated function
-- ============================================================================

SELECT 
    '=== TESTING UPDATED FUNCTION ===' as info;

-- Test the updated function
SELECT 
    'Updated function result:' as info,
    live_count as "Live Orders (PAID only)",
    earlier_today_count as "Earlier Today (PAID only)",
    history_count as "History (PAID only)",
    today_orders_count as "Today's Orders Total (ALL orders)"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 4: Verify the counts match what we see in Live Orders
-- ============================================================================

SELECT 
    '=== VERIFICATION ===' as info;

-- Show breakdown of today's orders by payment status
SELECT 
    'Today\'s orders breakdown:' as info,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE
GROUP BY payment_status
ORDER BY payment_status;
