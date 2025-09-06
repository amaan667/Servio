-- Create tables_with_sessions view to fix table management 500 error
-- Run this in your Supabase SQL Editor

-- 1. Create the missing tables_with_sessions view
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
    o.updated_at as order_updated_at
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
WHERE t.is_active = true;

-- 2. Grant permissions on the view
GRANT SELECT ON tables_with_sessions TO authenticated;
GRANT SELECT ON tables_with_sessions TO service_role;

-- 3. Show completion message
SELECT 'tables_with_sessions view created successfully!' as message;
