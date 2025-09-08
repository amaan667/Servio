-- =====================================================
-- RESERVATIONS & TABLE MANAGEMENT SYSTEM
-- =====================================================
-- Complete implementation with reservations, single open sessions, and counter mode

-- 1) Feature flag on venue
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_tables BOOLEAN NOT NULL DEFAULT true;

-- 2) Tables: identity only (do NOT store live status here)
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                -- e.g., "Table 7"
  seat_count INT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  qr_version INTEGER DEFAULT 1, -- increments if you reissue a QR
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tables_venue ON tables(venue_id) WHERE is_active;

-- 3) Table sessions: single open session per table
CREATE TYPE table_status AS ENUM (
  'FREE','OCCUPIED'  -- keep MVP simple; we'll treat READY/SERVED via order status
);

CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  status table_status NOT NULL,
  order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exactly one open session per table
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_session_per_table
ON table_sessions(table_id)
WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_open
ON table_sessions(venue_id)
WHERE closed_at IS NULL;

-- 4) Reservations: time-blocked holds (not seated)
CREATE TYPE reservation_status AS ENUM ('BOOKED','CHECKED_IN','CANCELLED','NO_SHOW');

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  table_id UUID NULL REFERENCES tables(id) ON DELETE SET NULL, -- can be unassigned
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  party_size INT NOT NULL DEFAULT 2,
  name TEXT,
  phone TEXT,
  status reservation_status NOT NULL DEFAULT 'BOOKED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_window
ON reservations(venue_id, start_at, end_at);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view tables for their venues" ON tables;
DROP POLICY IF EXISTS "Users can insert tables for their venues" ON tables;
DROP POLICY IF EXISTS "Users can update tables for their venues" ON tables;
DROP POLICY IF EXISTS "Users can delete tables for their venues" ON tables;

DROP POLICY IF EXISTS "Users can view table_sessions for their venues" ON table_sessions;
DROP POLICY IF EXISTS "Users can insert table_sessions for their venues" ON table_sessions;
DROP POLICY IF EXISTS "Users can update table_sessions for their venues" ON table_sessions;
DROP POLICY IF EXISTS "Users can delete table_sessions for their venues" ON table_sessions;

-- RLS policies for tables
CREATE POLICY "Users can view tables for their venues" ON tables
    FOR SELECT USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tables for their venues" ON tables
    FOR INSERT WITH CHECK (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tables for their venues" ON tables
    FOR UPDATE USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tables for their venues" ON tables
    FOR DELETE USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

-- RLS policies for table_sessions
CREATE POLICY "Users can view table_sessions for their venues" ON table_sessions
    FOR SELECT USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert table_sessions for their venues" ON table_sessions
    FOR INSERT WITH CHECK (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update table_sessions for their venues" ON table_sessions
    FOR UPDATE USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete table_sessions for their venues" ON table_sessions
    FOR DELETE USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

-- RLS policies for reservations
CREATE POLICY "Users can view reservations for their venues" ON reservations
    FOR SELECT USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert reservations for their venues" ON reservations
    FOR INSERT WITH CHECK (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update reservations for their venues" ON reservations
    FOR UPDATE USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete reservations for their venues" ON reservations
    FOR DELETE USING (
        venue_id IN (
            SELECT id FROM venues 
            WHERE owner_id = auth.uid()
        )
    );

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

-- Triggers for reservations
DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SERVER RPCs (ATOMIC MUTATIONS)
-- =====================================================

-- Reserve a free table (or create an unassigned reservation)
CREATE OR REPLACE FUNCTION api_reserve_table(
  p_venue_id UUID,
  p_table_id UUID,              -- allow null for unassigned reservation
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_party_size INT,
  p_name TEXT,
  p_phone TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO reservations(venue_id, table_id, start_at, end_at, party_size, name, phone, status)
  VALUES (p_venue_id, p_table_id, p_start_at, p_end_at, p_party_size, p_name, p_phone, 'BOOKED')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Seat (check-in) a reservation onto a table -> OCCUPIED
CREATE OR REPLACE FUNCTION api_checkin_reservation(
  p_reservation_id UUID,
  p_table_id UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_venue UUID;
BEGIN
  SELECT venue_id INTO v_venue FROM reservations WHERE id = p_reservation_id;

  -- close any open session on that table (should be FREE), then open OCCUPIED
  UPDATE table_sessions
    SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;

  INSERT INTO table_sessions(venue_id, table_id, status)
  VALUES (v_venue, p_table_id, 'OCCUPIED');

  UPDATE reservations
    SET status = 'CHECKED_IN', table_id = p_table_id, updated_at = NOW()
  WHERE id = p_reservation_id;
END $$;

-- Seat a walk-in (free -> occupied)
CREATE OR REPLACE FUNCTION api_seat_walkin(
  p_venue_id UUID,
  p_table_id UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE table_sessions SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;

  INSERT INTO table_sessions(venue_id, table_id, status)
  VALUES (p_venue_id, p_table_id, 'OCCUPIED');
END $$;

-- Close table -> end session and spawn FREE
CREATE OR REPLACE FUNCTION api_close_table(
  p_table_id UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_venue UUID;
BEGIN
  SELECT venue_id INTO v_venue FROM tables WHERE id = p_table_id;

  UPDATE table_sessions
    SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;

  INSERT INTO table_sessions(venue_id, table_id, status)
  VALUES (v_venue, p_table_id, 'FREE');
END $$;

-- =====================================================
-- COUNTERS & LISTS (SINGLE SOURCE OF TRUTH)
-- =====================================================

-- Current session per table
CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id UUID)
RETURNS TABLE(
  total_tables BIGINT,
  available BIGINT,
  occupied BIGINT,
  reserved_overlapping_now BIGINT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH cur AS (
    SELECT DISTINCT ON (ts.table_id)
           ts.table_id, ts.status
    FROM table_sessions ts
    JOIN tables t ON t.id = ts.table_id
    WHERE t.venue_id = p_venue_id
      AND t.is_active = true
      AND ts.closed_at IS NULL
    ORDER BY ts.table_id, ts.opened_at DESC
  ),
  res_now AS (
    -- reservations overlapping NOW and still BOOKED
    SELECT COUNT(*) as cnt
    FROM reservations r
    WHERE r.venue_id = p_venue_id
      AND r.status = 'BOOKED'
      AND r.start_at <= NOW()
      AND r.end_at   >= NOW()
  )
  SELECT
    (SELECT COUNT(*) FROM tables t WHERE t.venue_id = p_venue_id AND t.is_active) as total_tables,
    (SELECT COUNT(*) FROM cur WHERE status = 'FREE') as available,
    (SELECT COUNT(*) FROM cur WHERE status = 'OCCUPIED') as occupied,
    (SELECT cnt FROM res_now) as reserved_overlapping_now;
END $$;

-- Grid data (table cards)
CREATE OR REPLACE FUNCTION api_tables_grid(p_venue_id UUID)
RETURNS TABLE(
  id UUID,
  label TEXT,
  seat_count INT,
  session_status table_status,
  opened_at TIMESTAMPTZ,
  order_id UUID,
  total_amount BIGINT,
  order_status TEXT,
  order_updated_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.label, t.seat_count,
    s.status as session_status,
    s.opened_at,
    o.id as order_id, o.total_amount, o.order_status, o.updated_at as order_updated_at
  FROM tables t
  LEFT JOIN table_sessions s
    ON s.table_id = t.id AND s.closed_at IS NULL
  LEFT JOIN orders o
    ON o.id = s.order_id
  WHERE t.venue_id = p_venue_id AND t.is_active = true
  ORDER BY t.label ASC;
END $$;

-- =====================================================
-- OPTIONAL: STARTER FREE SESSION FOR EACH ACTIVE TABLE
-- =====================================================
CREATE OR REPLACE FUNCTION ensure_free_session_for_active_tables()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO table_sessions (venue_id, table_id, status)
  SELECT t.venue_id, t.id, 'FREE'::table_status
  FROM tables t
  LEFT JOIN table_sessions s
    ON s.table_id = t.id AND s.closed_at IS NULL
  WHERE t.is_active = true AND s.id IS NULL;
END $$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Reservations & Table Management system setup completed successfully!';
  RAISE NOTICE 'Tables: %', (SELECT COUNT(*) FROM tables);
  RAISE NOTICE 'Table Sessions: %', (SELECT COUNT(*) FROM table_sessions);
  RAISE NOTICE 'Reservations: %', (SELECT COUNT(*) FROM reservations);
END $$;
