-- Table Management Database Schema
-- This script creates the tables and table_sessions tables for the Table Management feature

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
-- Tracks table occupancy and lifecycle
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'FREE' CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED')),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for table_sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_order_id ON table_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened_at ON table_sessions(opened_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

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
-- FUNCTIONS
-- =====================================================

-- Function to automatically create a FREE session when a table is created
CREATE OR REPLACE FUNCTION create_initial_table_session()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    VALUES (NEW.venue_id, NEW.id, 'FREE', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create initial session
CREATE TRIGGER trigger_create_initial_table_session
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_table_session();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_tables_updated_at
    BEFORE UPDATE ON tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_table_sessions_updated_at
    BEFORE UPDATE ON table_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS
-- =====================================================

-- View to get tables with their current session and order info
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
    o.total_amount,
    o.customer_name,
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

-- Grant access to the view
GRANT SELECT ON tables_with_sessions TO authenticated;
