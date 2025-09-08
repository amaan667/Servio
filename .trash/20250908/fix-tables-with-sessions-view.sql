-- Fix the tables_with_sessions view to properly handle merged tables
-- The current view doesn't account for table_session_links, so merged tables appear as having no session

-- Drop the existing view
DROP VIEW IF EXISTS tables_with_sessions;

-- Create the updated view that handles merged tables
CREATE OR REPLACE VIEW tables_with_sessions AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    t.created_at as table_created_at,
    -- Get session info, checking for both direct sessions and linked sessions
    COALESCE(
        -- Direct session (if table has its own active session)
        ts.id,
        -- Linked session (if table is linked to another table's session)
        linked_ts.id
    ) as session_id,
    COALESCE(
        -- Direct session status
        ts.status,
        -- Linked session status
        linked_ts.status,
        -- Default to FREE if no session
        'FREE'
    ) as status,
    COALESCE(
        -- Direct session order
        ts.order_id,
        -- Linked session order
        linked_ts.order_id
    ) as order_id,
    COALESCE(
        -- Direct session opened_at
        ts.opened_at,
        -- Linked session opened_at
        linked_ts.opened_at
    ) as opened_at,
    COALESCE(
        -- Direct session closed_at
        ts.closed_at,
        -- Linked session closed_at
        linked_ts.closed_at
    ) as closed_at,
    -- Order information (from either direct or linked session)
    o.total_amount,
    o.customer_name,
    o.order_status,
    o.payment_status,
    o.updated_at as order_updated_at,
    -- Additional info about merge status
    CASE 
        WHEN tsl.table_id IS NOT NULL THEN true 
        ELSE false 
    END as is_merged,
    CASE 
        WHEN tsl.table_id IS NOT NULL THEN tsl.linked_to_table_id 
        ELSE NULL 
    END as merged_with_table_id
FROM tables t
-- Left join for direct sessions (most recent active session)
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
    AND ts.id = (
        SELECT id FROM table_sessions ts2 
        WHERE ts2.table_id = t.id 
        AND ts2.closed_at IS NULL
        ORDER BY ts2.opened_at DESC 
        LIMIT 1
    )
-- Left join for table links (if this table is linked to another table's session)
LEFT JOIN table_session_links tsl ON t.id = tsl.table_id
-- Left join for linked sessions (the session this table is linked to)
LEFT JOIN table_sessions linked_ts ON tsl.session_id = linked_ts.id 
    AND linked_ts.closed_at IS NULL
-- Left join for order information (from either direct or linked session)
LEFT JOIN orders o ON COALESCE(ts.order_id, linked_ts.order_id) = o.id
WHERE t.is_active = true;

-- Grant access to the view
GRANT SELECT ON tables_with_sessions TO authenticated;
GRANT SELECT ON tables_with_sessions TO anon;

-- Add comment explaining the view
COMMENT ON VIEW tables_with_sessions IS 'Shows tables with their current session info, including merged tables that are linked to other table sessions';
