-- Add table reset logic for daily reset and time-based expiration
-- This script adds functions to automatically reset tables to FREE status

-- Add reservation_duration_minutes column to table_sessions
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_table_sessions_reservation_duration ON table_sessions(reservation_duration_minutes);

-- Function to reset all tables to FREE at start of new day
CREATE OR REPLACE FUNCTION reset_tables_daily()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
    -- Close all current sessions and create new FREE sessions
    UPDATE table_sessions 
    SET 
        status = 'CLOSED',
        closed_at = NOW(),
        updated_at = NOW()
    WHERE closed_at IS NULL;
    
    -- Create new FREE sessions for all active tables
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    SELECT 
        t.venue_id,
        t.id,
        'FREE',
        NOW()
    FROM tables t
    WHERE t.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM table_sessions ts 
        WHERE ts.table_id = t.id 
        AND ts.closed_at IS NULL
    );
    
    RAISE NOTICE 'Daily table reset completed at %', NOW();
END;
$$;

-- Function to check and reset expired reservations
CREATE OR REPLACE FUNCTION reset_expired_reservations()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- Find and reset expired reservations
    WITH expired_sessions AS (
        SELECT ts.id, ts.table_id, ts.venue_id
        FROM table_sessions ts
        WHERE ts.status = 'RESERVED'
        AND ts.reservation_time IS NOT NULL
        AND ts.reservation_duration_minutes IS NOT NULL
        AND NOW() > (ts.reservation_time + INTERVAL '1 minute' * ts.reservation_duration_minutes)
    )
    UPDATE table_sessions 
    SET 
        status = 'CLOSED',
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM expired_sessions);
    
    -- Get count of expired sessions
    SELECT COUNT(*) INTO expired_count
    FROM table_sessions ts
    WHERE ts.status = 'RESERVED'
    AND ts.reservation_time IS NOT NULL
    AND ts.reservation_duration_minutes IS NOT NULL
    AND NOW() > (ts.reservation_time + INTERVAL '1 minute' * ts.reservation_duration_minutes);
    
    -- Create new FREE sessions for tables that had expired reservations
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    SELECT 
        t.venue_id,
        t.id,
        'FREE',
        NOW()
    FROM tables t
    WHERE t.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM table_sessions ts 
        WHERE ts.table_id = t.id 
        AND ts.closed_at IS NULL
    );
    
    IF expired_count > 0 THEN
        RAISE NOTICE 'Reset % expired reservations at %', expired_count, NOW();
    END IF;
END;
$$;

-- Function to get reservation end time for display
CREATE OR REPLACE FUNCTION get_reservation_end_time(reservation_start TIMESTAMPTZ, duration_minutes INTEGER)
RETURNS TIMESTAMPTZ 
LANGUAGE plpgsql 
IMMUTABLE AS $$
BEGIN
    RETURN reservation_start + INTERVAL '1 minute' * duration_minutes;
END;
$$;

-- Update the tables_with_sessions view to include reservation duration and end time
DROP VIEW IF EXISTS tables_with_sessions;

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
    CASE 
        WHEN ts.reservation_time IS NOT NULL AND ts.reservation_duration_minutes IS NOT NULL 
        THEN get_reservation_end_time(ts.reservation_time, ts.reservation_duration_minutes)
        ELSE NULL 
    END as reservation_end_time,
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

-- Create a function to run both reset functions (for scheduled execution)
CREATE OR REPLACE FUNCTION run_table_maintenance()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
    -- Reset expired reservations first
    PERFORM reset_expired_reservations();
    
    -- Check if it's a new day (00:00-00:05) and reset all tables
    IF EXTRACT(HOUR FROM NOW()) = 0 AND EXTRACT(MINUTE FROM NOW()) <= 5 THEN
        PERFORM reset_tables_daily();
    END IF;
END;
$$;

-- Completion message
DO $$
BEGIN
  RAISE NOTICE 'Table reset logic added successfully!';
  RAISE NOTICE 'Added columns: reservation_duration_minutes';
  RAISE NOTICE 'Created functions: reset_tables_daily(), reset_expired_reservations(), run_table_maintenance()';
  RAISE NOTICE 'Updated tables_with_sessions view with reservation duration and end time';
END $$;
