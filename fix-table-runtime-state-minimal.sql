-- Minimal fix for table_runtime_state view - only basic columns

-- 1. Drop the problematic view
DROP VIEW IF EXISTS table_runtime_state;

-- 2. Create a minimal working view with only basic columns that definitely exist
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
    ts.opened_at,
    ts.closed_at,
    t.created_at as most_recent_activity,
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
