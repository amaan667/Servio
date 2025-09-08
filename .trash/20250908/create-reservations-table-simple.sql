-- =====================================================
-- CREATE RESERVATIONS TABLE - SIMPLE VERSION
-- =====================================================
-- This script creates the reservations table to match the current schema

-- Create reservations table
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

-- Indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_venue_id ON reservations(venue_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- Enable RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view reservations for their venues" ON reservations;
DROP POLICY IF EXISTS "Users can insert reservations for their venues" ON reservations;
DROP POLICY IF EXISTS "Users can update reservations for their venues" ON reservations;
DROP POLICY IF EXISTS "Users can delete reservations for their venues" ON reservations;

-- RLS policies for reservations
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

-- Trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Completion message
DO $$
BEGIN
  RAISE NOTICE 'Reservations table created successfully!';
  RAISE NOTICE 'Reservations: %', (SELECT COUNT(*) FROM reservations);
END $$;
