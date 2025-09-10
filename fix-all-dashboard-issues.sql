-- Combined Fix for Dashboard Issues
-- 1. Fix Counter 10 display (shows as "Counter 10" instead of "Table 1")
-- 2. Fix table counting logic (shows correct number of tables set up)

-- ========================================
-- PART 1: Fix Counter 10 Display Issue
-- ========================================

SELECT '=== FIXING COUNTER 10 DISPLAY ===' as step;

-- Update orders on counter 10 to have source='counter'
UPDATE orders
SET source = 'counter'
WHERE table_number = 10 
  AND source = 'qr'  -- Only update if currently 'qr'
  AND created_at >= '2025-09-10'::date;

-- Verify counter 10 fix
SELECT 
  'Counter 10 orders fixed' as status,
  COUNT(*) as total_orders,
  SUM(CASE WHEN source = 'counter' THEN 1 ELSE 0 END) as counter_source_count
FROM orders
WHERE table_number = 10
  AND created_at >= '2025-09-10'::date;

-- ========================================
-- PART 2: Fix Table Counting Logic
-- ========================================

SELECT '=== FIXING TABLE COUNTING LOGIC ===' as step;

-- Fix the table_counters view (used by dashboard)
DROP VIEW IF EXISTS table_counters CASCADE;

CREATE OR REPLACE VIEW table_counters AS
SELECT 
    t.venue_id,
    COUNT(DISTINCT t.id) as total_tables,  -- Count ALL active tables from tables table
    COUNT(DISTINCT CASE 
        WHEN trs.primary_status = 'OCCUPIED' THEN t.id 
    END) as occupied,
    COUNT(DISTINCT CASE 
        WHEN trs.primary_status IS NULL OR trs.primary_status = 'FREE' THEN t.id 
    END) as free
FROM tables t
LEFT JOIN table_runtime_state trs ON t.id = trs.table_id AND t.venue_id = trs.venue_id
WHERE t.is_active = true
GROUP BY t.venue_id;

-- Fix the dashboard_counts function
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
    
    -- Count live orders (today within live window)
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end;
    
    -- Count earlier today orders (today but before live window)
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end;
    
    -- Count history orders (before today)
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start;
    
    -- Count total today's orders
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end;
    
    -- Count active tables (tables with current orders)
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
      AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING');
    
    -- CRITICAL FIX: Count ALL active tables from the tables table
    SELECT COUNT(*) INTO tables_set_up_val
    FROM tables 
    WHERE venue_id = p_venue_id
      AND is_active = true;
    
    -- Count tables currently in use
    SELECT COUNT(*) INTO tables_in_use_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id
      AND primary_status = 'OCCUPIED';
    
    -- Handle NULL values
    IF tables_in_use_val IS NULL THEN
        tables_in_use_val := 0;
    END IF;
    
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

-- Fix api_table_counters function if it exists
DROP FUNCTION IF EXISTS api_table_counters(text);

CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Get counts from the fixed table_counters view
    SELECT json_build_object(
        'total_tables', COALESCE(total_tables, 0),
        'occupied', COALESCE(occupied, 0),
        'free', COALESCE(free, 0),
        'available', COALESCE(free, 0)
    ) INTO result
    FROM table_counters
    WHERE venue_id = p_venue_id;
    
    -- If no data found, return zeros
    IF result IS NULL THEN
        result := json_build_object(
            'total_tables', 0,
            'occupied', 0,
            'free', 0,
            'available', 0
        );
    END IF;
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION api_table_counters(text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_table_counters(text) TO anon;

-- ========================================
-- VERIFICATION
-- ========================================

SELECT '=== VERIFICATION ===' as step;

-- Verify Counter 10 fix
SELECT 
    'Counter 10 Display' as check_item,
    CASE 
        WHEN COUNT(CASE WHEN source = 'counter' THEN 1 END) > 0 
        THEN '✅ Fixed - Orders will show as "Counter 10"'
        ELSE '❌ Still needs fixing'
    END as status
FROM orders
WHERE table_number = 10
  AND created_at >= '2025-09-10'::date;

-- Verify table counts
SELECT 
    'Table Counts' as check_item,
    'Actual tables: ' || COUNT(*) || ', Dashboard will show: ' || 
    (SELECT tables_set_up FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30)) as status
FROM tables 
WHERE venue_id = 'venue-1e02af4d' AND is_active = true;

-- Show final results
SELECT '=== FINAL DASHBOARD VALUES ===' as step;
SELECT 
    tables_set_up as "Tables Set Up (Should be > 1)",
    tables_in_use as "Tables In Use",
    today_orders_count as "Today's Orders",
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

SELECT '✅ All fixes applied successfully!' as status;
