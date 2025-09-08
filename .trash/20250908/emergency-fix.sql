-- Emergency fix for loading issues
-- This addresses the most common problems

-- 1. Ensure table_sessions has the required columns
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- 2. Ensure table_status enum has all required values
DO $$
BEGIN
    -- Add missing enum values if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'RESERVED') THEN
        ALTER TYPE table_status ADD VALUE 'RESERVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'ORDERING') THEN
        ALTER TYPE table_status ADD VALUE 'ORDERING';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'IN_PREP') THEN
        ALTER TYPE table_status ADD VALUE 'IN_PREP';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'READY') THEN
        ALTER TYPE table_status ADD VALUE 'READY';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'SERVED') THEN
        ALTER TYPE table_status ADD VALUE 'SERVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'AWAITING_BILL') THEN
        ALTER TYPE table_status ADD VALUE 'AWAITING_BILL';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'CLOSED') THEN
        ALTER TYPE table_status ADD VALUE 'CLOSED';
    END IF;
END $$;

-- 3. Update any existing rows with invalid status
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL OR status NOT IN (
    'FREE', 'OCCUPIED', 'RESERVED', 'ORDERING', 
    'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED'
);

-- 4. Ensure all tables have sessions
INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
SELECT t.venue_id, t.id, 'FREE', NOW()
FROM tables t
WHERE NOT EXISTS (
    SELECT 1 FROM table_sessions ts 
    WHERE ts.table_id = t.id 
    AND ts.closed_at IS NULL
)
AND t.is_active = true;

-- 5. Drop and recreate the view to ensure it works
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

-- Grant permissions
GRANT SELECT ON tables_with_sessions TO authenticated;
