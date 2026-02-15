-- Run this in Supabase SQL Editor to fix api_table_counters

-- Step 1: Check if the function exists
SELECT routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'api_table_counters';

-- Step 2: Drop if exists and recreate
DROP FUNCTION IF EXISTS api_table_counters(text);

-- Step 3: Create the function with proper return type
CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id text)
RETURNS TABLE(
    tables_set_up integer,
    tables_in_use integer,
    tables_reserved_now integer,
    active_tables_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tables_set_up_val integer;
    tables_in_use_val integer;
    tables_reserved_now_val integer;
    today_start timestamptz;
    today_end timestamptz;
BEGIN
    -- Validate input
    IF p_venue_id IS NULL OR p_venue_id = '' THEN
        RAISE EXCEPTION 'venue_id cannot be null or empty';
    END IF;

    today_start := date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London';
    today_end := today_start + INTERVAL '1 day';
    
    SELECT COUNT(*) INTO tables_set_up_val
    FROM tables 
    WHERE venue_id = p_venue_id AND is_active = true;
    
    SELECT COUNT(DISTINCT t.id) INTO tables_in_use_val
    FROM tables t
    INNER JOIN orders o ON o.table_id = t.id
    WHERE t.venue_id = p_venue_id
      AND t.is_active = true
      AND o.created_at >= today_start
      AND o.created_at < today_end
      AND o.payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');
    
    SELECT COUNT(DISTINCT table_id) INTO tables_reserved_now_val
    FROM reservations
    WHERE venue_id = p_venue_id
      AND status = 'BOOKED'
      AND start_time <= NOW()
      AND end_time >= NOW();
    
    RETURN QUERY SELECT 
        tables_set_up_val,
        tables_in_use_val,
        COALESCE(tables_reserved_now_val, 0),
        tables_in_use_val;
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION api_table_counters(text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_table_counters(text) TO anon;

-- Step 5: Test the function
SELECT * FROM api_table_counters('venue-1e02af4d');
