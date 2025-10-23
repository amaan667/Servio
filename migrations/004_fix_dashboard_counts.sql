-- Migration 004: Fix dashboard counts and table management
-- Purpose: Ensure all counts are accurate and tables auto-reset at midnight

-- ============================================================================
-- 1. Update dashboard_counts function to correctly calculate Today's Orders
-- ============================================================================

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
    today_end := today_start + INTERVAL '1 day';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND order_status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED');
    
    -- Count earlier today orders (today but before live window) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND order_status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED');
    
    -- Count history orders (before today) - include PAID, PAY_LATER, and TILL
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND order_status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED');
    
    -- Count total today's orders (live + earlier today) - include PAID, PAY_LATER, and TILL
    today_orders_count_val := live_count_val + earlier_today_count_val;
    
    -- Count active tables (tables from tables table, not from orders)
    SELECT COUNT(*) INTO tables_set_up_val
    FROM tables 
    WHERE venue_id = p_venue_id
      AND is_active = true;
    
    -- Count tables currently in use (with active orders today)
    SELECT COUNT(DISTINCT t.id) INTO tables_in_use_val
    FROM tables t
    INNER JOIN orders o ON o.table_id = t.id
    WHERE t.venue_id = p_venue_id
      AND t.is_active = true
      AND o.created_at >= today_start
      AND o.created_at < today_end
      AND o.payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');
    
    -- For backwards compatibility, set active_tables_count to tables_in_use
    active_tables_count_val := tables_in_use_val;
    
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

-- ============================================================================
-- 2. Create/Update api_table_counters function to match actual tables
-- ============================================================================

DROP FUNCTION IF EXISTS api_table_counters(text);

CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id text)
RETURNS TABLE(
    tables_set_up integer,
    tables_in_use integer,
    tables_reserved_now integer,
    active_tables_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    tables_set_up_val integer;
    tables_in_use_val integer;
    tables_reserved_now_val integer;
    today_start timestamptz;
    today_end timestamptz;
BEGIN
    -- Calculate today's window
    today_start := date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London';
    today_end := today_start + INTERVAL '1 day';
    
    -- Count total tables set up (active tables)
    SELECT COUNT(*) INTO tables_set_up_val
    FROM tables 
    WHERE venue_id = p_venue_id
      AND is_active = true;
    
    -- Count tables currently in use (with active orders today)
    SELECT COUNT(DISTINCT t.id) INTO tables_in_use_val
    FROM tables t
    INNER JOIN orders o ON o.table_id = t.id
    WHERE t.venue_id = p_venue_id
      AND t.is_active = true
      AND o.created_at >= today_start
      AND o.created_at < today_end
      AND o.payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');
    
    -- Count tables with reservations overlapping now
    SELECT COUNT(DISTINCT table_id) INTO tables_reserved_now_val
    FROM reservations
    WHERE venue_id = p_venue_id
      AND status = 'BOOKED'
      AND start_time <= NOW()
      AND end_time >= NOW();
    
    -- Return the results
    RETURN QUERY SELECT 
        tables_set_up_val,
        tables_in_use_val,
        COALESCE(tables_reserved_now_val, 0),
        tables_in_use_val; -- active_tables_count is same as tables_in_use
END;
$$;

-- ============================================================================
-- 3. Add comments for clarity
-- ============================================================================

COMMENT ON FUNCTION dashboard_counts IS 'Returns dashboard counts including correct calculation of today''s orders (live + earlier today)';
COMMENT ON FUNCTION api_table_counters IS 'Returns table counters based on actual tables table, not runtime state';

