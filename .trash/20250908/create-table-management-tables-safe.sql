-- =====================================================
-- TABLE MANAGEMENT SETUP - SAFE VERSION
-- =====================================================
-- This script safely creates tables and policies, handling existing ones gracefully

-- =====================================================
-- TABLES TABLE
-- =====================================================
-- Stores table information for each venue
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- "Table 1", "Table 2", etc.
    seat_count INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    qr_version INTEGER DEFAULT 1, -- increments if you reissue a QR
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tables
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_tables_is_active ON tables(is_active);
CREATE INDEX IF NOT EXISTS idx_tables_label ON tables(label);

-- =====================================================
-- TABLE_SESSIONS TABLE
-- =====================================================
-- Tracks table occupancy and status
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'FREE' CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED')),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for table_sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_order_id ON table_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened_at ON table_sessions(opened_at);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for tables
DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
CREATE TRIGGER update_tables_updated_at
    BEFORE UPDATE ON tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers for table_sessions
DROP TRIGGER IF EXISTS update_table_sessions_updated_at ON table_sessions;
CREATE TRIGGER update_table_sessions_updated_at
    BEFORE UPDATE ON table_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view tables for their venues" ON tables;
DROP POLICY IF EXISTS "Users can insert tables for their venues" ON tables;
DROP POLICY IF EXISTS "Users can update tables for their venues" ON tables;
DROP POLICY IF EXISTS "Users can delete tables for their venues" ON tables;

-- RLS policies for tables
CREATE POLICY "Users can view tables for their venues" ON tables
    FOR SELECT USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tables for their venues" ON tables
    FOR INSERT WITH CHECK (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tables for their venues" ON tables
    FOR UPDATE USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tables for their venues" ON tables
    FOR DELETE USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view table_sessions for their venues" ON table_sessions;
DROP POLICY IF EXISTS "Users can insert table_sessions for their venues" ON table_sessions;
DROP POLICY IF EXISTS "Users can update table_sessions for their venues" ON table_sessions;
DROP POLICY IF EXISTS "Users can delete table_sessions for their venues" ON table_sessions;

-- RLS policies for table_sessions
CREATE POLICY "Users can view table_sessions for their venues" ON table_sessions
    FOR SELECT USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert table_sessions for their venues" ON table_sessions
    FOR INSERT WITH CHECK (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update table_sessions for their venues" ON table_sessions
    FOR UPDATE USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete table_sessions for their venues" ON table_sessions
    FOR DELETE USING (
        venue_id IN (
            SELECT venue_id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

-- =====================================================
-- VIEW FOR OPTIMIZED QUERIES
-- =====================================================
-- This view combines tables with their latest active session and order info
-- First ensure qr_version column exists
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

-- Update existing tables to have qr_version = 1 if they're NULL
UPDATE tables SET qr_version = 1 WHERE qr_version IS NULL;

-- Now create the view
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

-- =====================================================
-- FUNCTION TO CREATE FREE SESSION FOR NEW TABLES
-- =====================================================
-- This function automatically creates a FREE session when a new table is created
CREATE OR REPLACE FUNCTION create_free_session_for_new_table()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
    VALUES (NEW.id, NEW.venue_id, 'FREE', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically create FREE session for new tables
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
-- This will show a success message when the script completes
DO $$
BEGIN
    RAISE NOTICE 'Table Management setup completed successfully!';
    RAISE NOTICE 'Tables: %', (SELECT COUNT(*) FROM tables);
    RAISE NOTICE 'Table Sessions: %', (SELECT COUNT(*) FROM table_sessions);
END $$;
