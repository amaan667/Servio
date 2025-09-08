-- COMPLETE TABLE MANAGEMENT FIX
-- This script ensures all required tables, columns, and views exist for table management

-- 1. Ensure table_sessions has all required columns
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- 2. Add missing enum values to table_status
DO $$
BEGIN
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

-- 3. Update existing data
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL;

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

-- 5. Recreate the tables_with_sessions view
DROP VIEW IF EXISTS tables_with_sessions;

CREATE VIEW tables_with_sessions AS
SELECT 
    t.id, t.venue_id, t.label, t.seat_count, t.is_active, t.qr_version,
    t.created_at as table_created_at,
    ts.id as session_id, ts.status, ts.order_id, ts.opened_at, ts.closed_at,
    ts.customer_name, ts.reservation_time, ts.reservation_duration_minutes,
    o.total_amount, o.customer_name as order_customer_name, o.order_status,
    o.payment_status, o.updated_at as order_updated_at
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
    AND ts.id = (SELECT id FROM table_sessions ts2 WHERE ts2.table_id = t.id ORDER BY ts2.opened_at DESC LIMIT 1)
LEFT JOIN orders o ON ts.order_id = o.id
WHERE t.is_active = true;

-- 6. Create or recreate the table_runtime_state view
DROP VIEW IF EXISTS table_runtime_state;

CREATE VIEW table_runtime_state AS
SELECT 
    t.id as table_id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    ts.id as session_id,
    
    -- PRIMARY STATE: FREE (available for seating) or OCCUPIED (currently seated)
    CASE 
        WHEN ts.status = 'FREE' THEN 'FREE'
        WHEN ts.status IN ('ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL') THEN 'OCCUPIED'
        ELSE 'FREE'
    END as primary_status,
    ts.opened_at,
    ts.server_id,
    
    -- SECONDARY LAYER: Reservation status underneath the primary state
    CASE 
        WHEN rn.id IS NOT NULL THEN 'RESERVED_NOW'
        WHEN rl.id IS NOT NULL THEN 'RESERVED_LATER'
        ELSE 'NONE'
    END as reservation_status,
    
    -- Current reservation (due now)
    rn.id as reserved_now_id,
    rn.start_at as reserved_now_start,
    rn.end_at as reserved_now_end,
    rn.party_size as reserved_now_party_size,
    rn.name as reserved_now_name,
    rn.phone as reserved_now_phone,
    
    -- Next reservation (later today)
    rl.id as next_reservation_id,
    rl.start_at as next_reservation_start,
    rl.end_at as next_reservation_end,
    rl.party_size as next_reservation_party_size,
    rl.name as next_reservation_name,
    rl.phone as next_reservation_phone

FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
    AND ts.id = (SELECT id FROM table_sessions ts2 WHERE ts2.table_id = t.id ORDER BY ts2.opened_at DESC LIMIT 1)
LEFT JOIN reservations rn ON t.id = rn.table_id 
    AND rn.status = 'BOOKED'
    AND rn.start_at <= NOW() + INTERVAL '30 minutes'
    AND rn.start_at >= NOW() - INTERVAL '30 minutes'
LEFT JOIN reservations rl ON t.id = rl.table_id 
    AND rl.status = 'BOOKED'
    AND rl.start_at > NOW() + INTERVAL '30 minutes'
    AND rl.start_at::date = CURRENT_DATE
    AND rl.id != COALESCE(rn.id, '')
WHERE t.is_active = true;

-- 7. Grant permissions
GRANT SELECT ON tables_with_sessions TO authenticated;
GRANT SELECT ON table_runtime_state TO authenticated;

-- 8. Success message
SELECT 'TABLE MANAGEMENT FIX APPLIED SUCCESSFULLY!' as result;