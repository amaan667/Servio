-- Fix missing reservation_duration_minutes column in table_sessions
-- This script adds the missing column that's causing the reservation creation to fail

-- Add reservation_duration_minutes column to table_sessions
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_table_sessions_reservation_duration ON table_sessions(reservation_duration_minutes);

-- Drop the existing view first to avoid column name conflicts
DROP VIEW IF EXISTS tables_with_sessions;

-- Recreate the tables_with_sessions view to include the new column
CREATE VIEW tables_with_sessions AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    t.qr_version,
    t.created_at as table_created_at,
    ts.id as session_id,
    ts.status,
    ts.order_id,
    ts.opened_at,
    ts.closed_at,
    ts.customer_name,
    ts.reservation_time,
    ts.reservation_duration_minutes,
    o.total_amount,
    o.customer_name as order_customer_name,
    o.order_status,
    o.payment_status,
    o.updated_at as order_updated_at
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
    AND ts.id = (
        SELECT id FROM table_sessions ts2 
        WHERE ts2.table_id = t.id 
        ORDER BY ts2.opened_at DESC 
        LIMIT 1
    )
LEFT JOIN orders o ON ts.order_id = o.id
WHERE t.is_active = true;

-- Grant access to the updated view
GRANT SELECT ON tables_with_sessions TO authenticated;

-- Completion message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added reservation_duration_minutes column to table_sessions table!';
  RAISE NOTICE 'Updated tables_with_sessions view to include new column';
END $$;
