-- Fix the table_runtime_state view to include table_id field for consistency with TableRuntimeState interface

-- 1. Drop the existing view
DROP VIEW IF EXISTS table_runtime_state;

-- 2. Create the corrected view with table_id field and proper status fields
CREATE VIEW table_runtime_state AS
SELECT 
    t.id,
    t.id as table_id,  -- Add table_id field for consistency with frontend interface
    t.venue_id,
    t.label,
    t.seat_count,
    t.area,
    t.is_active,
    t.created_at,
    t.updated_at,
    t.qr_version,
    ts.id as session_id,
    -- Map status to primary_status for interface compatibility
    CASE 
        WHEN ts.status = 'FREE' THEN 'FREE'
        WHEN ts.status = 'OCCUPIED' THEN 'OCCUPIED'
        ELSE 'FREE'
    END as primary_status,
    ts.opened_at,
    ts.server_id,
    -- Set reservation status to NONE for now (can be enhanced later)
    'NONE' as reservation_status,
    ts.order_id,
    ts.closed_at,
    ts.total_amount,
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
    NULL::INTEGER as reserved_now_party_size,
    NULL::UUID as next_reservation_id,
    NULL::TIMESTAMPTZ as next_reservation_start,
    NULL::TIMESTAMPTZ as next_reservation_end,
    NULL::TEXT as next_reservation_name,
    NULL::TEXT as next_reservation_phone,
    NULL::INTEGER as next_reservation_party_size
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
WHERE t.is_active = true;

-- 3. Test the corrected view
SELECT 'Testing corrected view with table_id:' as info;
SELECT 
    id,
    table_id,
    venue_id,
    label,
    seat_count,
    is_active
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
