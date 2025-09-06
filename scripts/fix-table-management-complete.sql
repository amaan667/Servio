-- =====================================================
-- COMPLETE TABLE MANAGEMENT FIX
-- =====================================================
-- This script fixes all table management issues

-- 1. Create the missing update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  table_id UUID NULL REFERENCES tables(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_venue_id ON reservations(venue_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- 4. Enable RLS on reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view reservations for their venues" ON reservations;
DROP POLICY IF EXISTS "Users can insert reservations for their venues" ON reservations;
DROP POLICY IF EXISTS "Users can update reservations for their venues" ON reservations;
DROP POLICY IF EXISTS "Users can delete reservations for their venues" ON reservations;

-- 6. Create RLS policies for reservations
CREATE POLICY "Users can view reservations for their venues" ON reservations
    FOR SELECT USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert reservations for their venues" ON reservations
    FOR INSERT WITH CHECK (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update reservations for their venues" ON reservations
    FOR UPDATE USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete reservations for their venues" ON reservations
    FOR DELETE USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

-- 7. Create trigger for reservations updated_at
DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Ensure tables have qr_version column
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
    END IF;
END $$;

-- 9. Update existing tables to have qr_version = 1 if they're NULL
UPDATE tables SET qr_version = 1 WHERE qr_version IS NULL;

-- 10. Create or replace the tables_with_sessions view
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

-- 11. Ensure all active tables have a FREE session
INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
SELECT t.id, t.venue_id, 'FREE', NOW()
FROM tables t
LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
WHERE t.is_active = true AND ts.id IS NULL;

-- 12. Completion message
DO $$
BEGIN
  RAISE NOTICE 'Table Management fix completed successfully!';
  RAISE NOTICE 'Tables: %', (SELECT COUNT(*) FROM tables);
  RAISE NOTICE 'Table Sessions: %', (SELECT COUNT(*) FROM table_sessions);
  RAISE NOTICE 'Reservations: %', (SELECT COUNT(*) FROM reservations);
  RAISE NOTICE 'Active Tables with FREE sessions: %', (
    SELECT COUNT(*) FROM tables t 
    JOIN table_sessions ts ON ts.table_id = t.id 
    WHERE t.is_active = true AND ts.closed_at IS NULL AND ts.status = 'FREE'
  );
END $$;
