-- Update payment status from UNPAID to PAY_LATER for better clarity
-- This makes it clear that these are "pay later" orders, not just unpaid orders

-- First, update existing orders that have payment_method = 'later' to use PAY_LATER status
UPDATE orders 
SET payment_status = 'PAY_LATER'
WHERE payment_method = 'later' AND payment_status = 'UNPAID';

-- Update the dashboard_counts function to include PAY_LATER status
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
    -- Calculate time windows based on timezone
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day' - INTERVAL '1 second';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
    
    -- Count earlier today orders (today but before live window) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
    
    -- Count history orders (before today) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
    
    -- Count total today's orders - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
    
    -- Count active tables (tables with current orders) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
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

-- Test the updated function
SELECT 
    'Testing updated dashboard_counts function with PAY_LATER...' as info,
    *
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO anon;

-- Show the updated function definition
SELECT 
    'Function updated successfully with PAY_LATER support!' as info,
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'dashboard_counts';
