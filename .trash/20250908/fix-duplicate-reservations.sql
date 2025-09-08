-- Fix duplicate reservations issue in tables_with_sessions view
-- This ensures each table shows only one reservation at a time
-- Run this in your Supabase SQL Editor

-- Drop and recreate the view with proper LATERAL joins to prevent duplicates
DROP VIEW IF EXISTS tables_with_sessions;

CREATE OR REPLACE VIEW tables_with_sessions AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    t.qr_version,
    t.created_at as table_created_at,
    ts.id as session_id,
    COALESCE(ts.status, 'FREE') as status,
    ts.order_id,
    ts.opened_at,
    ts.closed_at,
    o.total_amount,
    o.customer_name,
    o.order_status,
    o.payment_status,
    o.updated_at as order_updated_at,
    ts.reservation_time,
    ts.reservation_duration_minutes,
    CASE 
        WHEN ts.reservation_time IS NOT NULL AND ts.reservation_duration_minutes IS NOT NULL 
        THEN (ts.reservation_time::timestamp + (ts.reservation_duration_minutes || ' minutes')::interval)::timestamptz
        ELSE NULL
    END as reservation_end_time,
    r.created_at as reservation_created_at,
    -- Calculate most recent activity timestamp
    GREATEST(
        COALESCE(ts.opened_at, '1970-01-01'::timestamptz),
        COALESCE(o.updated_at, '1970-01-01'::timestamptz),
        COALESCE(r.created_at, '1970-01-01'::timestamptz),
        t.created_at
    ) as most_recent_activity
FROM tables t
LEFT JOIN LATERAL (
    SELECT *
    FROM table_sessions ts2
    WHERE ts2.table_id = t.id
    AND ts2.closed_at IS NULL
    ORDER BY ts2.opened_at DESC
    LIMIT 1
) ts ON true
LEFT JOIN orders o ON ts.order_id = o.id
LEFT JOIN LATERAL (
    SELECT *
    FROM reservations r2
    WHERE r2.table_id = t.id
    AND r2.status = 'BOOKED'
    ORDER BY r2.created_at DESC
    LIMIT 1
) r ON true
WHERE t.is_active = true;

-- Grant permissions on the view
GRANT SELECT ON tables_with_sessions TO authenticated;
GRANT SELECT ON tables_with_sessions TO service_role;

-- Show completion message
SELECT 'tables_with_sessions view fixed - no more duplicate reservations!' as message;
