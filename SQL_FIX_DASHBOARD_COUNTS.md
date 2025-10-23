# SQL to Fix Dashboard Counts

Run this in Supabase SQL Editor:

```sql
-- Fix dashboard_counts function
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
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND order_status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED');
    
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at < today_end
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND order_status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED');
    
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
      AND order_status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED');
    
    today_orders_count_val := live_count_val + earlier_today_count_val;
    
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
    
    active_tables_count_val := tables_in_use_val;
    
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

-- Fix api_table_counters function
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
```

