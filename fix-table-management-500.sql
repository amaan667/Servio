-- Fix Table Management HTTP 500 Error
-- This script fixes the missing view and foreign key relationship issues

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

-- 2. Add foreign key constraint between table_sessions and orders
-- First check if the constraint already exists
DO $$
BEGIN
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_table_sessions_order_id' 
        AND table_name = 'table_sessions'
    ) THEN
        ALTER TABLE table_sessions 
        ADD CONSTRAINT fk_table_sessions_order_id 
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added foreign key constraint between table_sessions and orders';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- 3. Ensure the table_sessions table has the correct structure
-- Add any missing columns if they don't exist
DO $$
BEGIN
    -- Check if venue_id column exists and is correct type
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'table_sessions' 
        AND column_name = 'venue_id'
        AND data_type = 'text'
    ) THEN
        -- Add venue_id column if it doesn't exist
        ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS venue_id TEXT;
        
        -- Update existing records to have venue_id from their table
        UPDATE table_sessions 
        SET venue_id = t.venue_id
        FROM tables t 
        WHERE table_sessions.table_id = t.id 
        AND table_sessions.venue_id IS NULL;
        
        -- Add foreign key constraint
        ALTER TABLE table_sessions 
        ADD CONSTRAINT fk_table_sessions_venue_id 
        FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added venue_id column and constraint to table_sessions';
    ELSE
        RAISE NOTICE 'venue_id column already exists in table_sessions';
    END IF;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_order_id ON table_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_closed_at ON table_sessions(closed_at);

-- 5. Grant permissions on the view
GRANT SELECT ON tables_with_sessions TO authenticated;
GRANT SELECT ON tables_with_sessions TO service_role;

-- 6. Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Table management HTTP 500 error fix completed successfully!';
    RAISE NOTICE 'Created tables_with_sessions view';
    RAISE NOTICE 'Added foreign key constraints';
    RAISE NOTICE 'Added performance indexes';
    RAISE NOTICE 'The /api/tables endpoint should now work properly.';
END $$;
