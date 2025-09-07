-- Add reservation columns to table_sessions table
-- This script adds customer_name and reservation_time columns to store reservation data

-- Add customer_name column to table_sessions
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Add reservation_time column to table_sessions  
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_time TIMESTAMPTZ;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_table_sessions_customer_name ON table_sessions(customer_name);
CREATE INDEX IF NOT EXISTS idx_table_sessions_reservation_time ON table_sessions(reservation_time);

-- Update the tables_with_sessions view to include the new columns
CREATE OR REPLACE VIEW tables_with_sessions AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    t.created_at as table_created_at,
    ts.id as session_id,
    ts.status,
    ts.order_id,
    ts.opened_at,
    ts.closed_at,
    ts.customer_name,
    ts.reservation_time,
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
  RAISE NOTICE 'Successfully added reservation columns to table_sessions table!';
  RAISE NOTICE 'Added columns: customer_name, reservation_time';
  RAISE NOTICE 'Updated tables_with_sessions view to include new columns';
END $$;
