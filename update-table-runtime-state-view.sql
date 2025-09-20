-- Update table_runtime_state view to include merged_with_table_id column

-- Drop the existing view
DROP VIEW IF EXISTS table_runtime_state;

-- Create the updated view with merged_with_table_id column
CREATE VIEW table_runtime_state AS
SELECT 
    t.id,
    t.table_id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.area,
    t.is_active,
    t.created_at,
    t.updated_at,
    t.qr_version,
    t.kind,
    t.merged_with_table_id,
    ts.id as session_id,
    COALESCE(ts.status::TEXT, 'FREE') as primary_status,
    ts.order_id,
    ts.opened_at,
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
    NULL::INTEGER as next_reservation_party_size,
    'NONE'::TEXT as reservation_status,
    NULL::TEXT as server_id
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
WHERE t.is_active = true;
