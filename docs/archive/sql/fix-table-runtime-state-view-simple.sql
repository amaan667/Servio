-- Fix the table_runtime_state view with only existing columns

-- 1. Drop the problematic view
DROP VIEW IF EXISTS table_runtime_state;

-- 2. Create a corrected view with only existing columns
CREATE VIEW table_runtime_state AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.area,
    t.is_active,
    t.created_at,
    t.updated_at,
    t.qr_version,
    ts.id as session_id,
    COALESCE(ts.status::TEXT, 'FREE') as status,
    ts.order_id,
    ts.opened_at,
    ts.closed_at,
    ts.customer_name,
    COALESCE(ts.order_status::TEXT, 'PENDING') as order_status,
    COALESCE(ts.payment_status::TEXT, 'PENDING') as payment_status,
    ts.order_updated_at,
    ts.reservation_time,
    ts.reservation_duration_minutes,
    ts.reservation_end_time,
    ts.reservation_created_at,
    COALESCE(ts.most_recent_activity, t.created_at) as most_recent_activity,
    NULL::UUID as reserved_now_id,
    NULL::TIMESTAMPTZ as reserved_now_start,
    NULL::TIMESTAMPTZ as reserved_now_end,
    NULL::TEXT as reserved_now_name,
    NULL::TEXT as reserved_now_phone,
    NULL::UUID as reserved_later_id,
    NULL::TIMESTAMPTZ as reserved_later_start,
    NULL::TIMESTAMPTZ as reserved_later_end,
    NULL::TEXT as reserved_later_name,
    NULL::TEXT as reserved_later_phone,
    0::INTEGER as block_window_mins
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
WHERE t.is_active = true;

-- 3. Test the corrected view
SELECT 'Testing corrected view:' as info;
SELECT *
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label ASC
LIMIT 5;

-- 4. Show the view structure
SELECT 'View structure after fix:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'table_runtime_state'
  AND table_schema = 'public'
ORDER BY ordinal_position;
