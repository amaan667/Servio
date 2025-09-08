-- =====================================================
-- MIGRATION: Add qr_version column to existing tables
-- =====================================================
-- This script adds the missing qr_version column to existing tables

-- Add qr_version column to tables if it doesn't exist
DO $$
BEGIN
    -- Check if qr_version column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tables' 
        AND column_name = 'qr_version'
    ) THEN
        -- Add the column
        ALTER TABLE tables ADD COLUMN qr_version INTEGER DEFAULT 1;
        RAISE NOTICE 'Added qr_version column to tables table';
    ELSE
        RAISE NOTICE 'qr_version column already exists in tables table';
    END IF;
END $$;

-- Update existing tables to have qr_version = 1 if they're NULL
UPDATE tables SET qr_version = 1 WHERE qr_version IS NULL;

-- Recreate the view to include qr_version
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

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Tables with qr_version: %', (SELECT COUNT(*) FROM tables WHERE qr_version IS NOT NULL);
END $$;
