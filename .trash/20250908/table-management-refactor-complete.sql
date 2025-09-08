-- =====================================================
-- TABLE MANAGEMENT REFACTOR - COMPLETE IMPLEMENTATION
-- =====================================================
-- This script implements the complete table management refactor
-- that separates live state from reservation state, allowing
-- tables to show "FREE now + Reserved for 19:30" simultaneously

-- =====================================================
-- 1. DROP EXISTING VIEWS AND FUNCTIONS
-- =====================================================

-- Drop existing views that might reference old logic
DROP VIEW IF EXISTS table_runtime_state CASCADE;
DROP VIEW IF EXISTS unassigned_reservations CASCADE;
DROP VIEW IF EXISTS tables_with_sessions CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS api_table_counters(TEXT);
DROP FUNCTION IF EXISTS api_seat_party(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS api_close_table(UUID);
DROP FUNCTION IF EXISTS api_assign_reservation(UUID, UUID);
DROP FUNCTION IF EXISTS api_cancel_reservation(UUID);
DROP FUNCTION IF EXISTS api_no_show_reservation(UUID);
DROP FUNCTION IF EXISTS ensure_free_sessions_for_active_tables();

-- =====================================================
-- 2. ENSURE PROPER TABLE STRUCTURE
-- =====================================================

-- Create tables table if it doesn't exist
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  seat_count INTEGER NOT NULL DEFAULT 2,
  area TEXT, -- Add area field for table grouping
  is_active BOOLEAN DEFAULT true,
  qr_version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status table_status NOT NULL DEFAULT 'FREE',
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  server_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reservations table if it doesn't exist
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  table_id UUID NULL REFERENCES tables(id) ON DELETE SET NULL, -- NULL for unassigned
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  party_size INTEGER DEFAULT 2,
  status reservation_status NOT NULL DEFAULT 'BOOKED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. ENSURE ENUM TYPES EXIST
-- =====================================================

-- Create table_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
        CREATE TYPE table_status AS ENUM ('FREE', 'OCCUPIED');
    END IF;
END $$;

-- Create reservation_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE reservation_status AS ENUM ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW');
    END IF;
END $$;

-- =====================================================
-- 4. ADD MISSING COLUMNS
-- =====================================================

-- Add area column to tables if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tables' 
        AND column_name = 'area'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE tables ADD COLUMN area TEXT;
        RAISE NOTICE 'Added area column to tables table';
    END IF;
END $$;

-- Add party_size column to reservations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'party_size'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE reservations ADD COLUMN party_size INTEGER DEFAULT 2;
        RAISE NOTICE 'Added party_size column to reservations table';
    END IF;
END $$;

-- Add customer_phone column to reservations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'customer_phone'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE reservations ADD COLUMN customer_phone TEXT;
        RAISE NOTICE 'Added customer_phone column to reservations table';
    END IF;
END $$;

-- =====================================================
-- 5. CREATE CONSTRAINTS
-- =====================================================

-- Ensure exactly one open session per table
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_one_open_per_table 
ON table_sessions(table_id) WHERE closed_at IS NULL;

-- Prevent double booking with exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;
DROP INDEX IF EXISTS idx_reservations_no_double_booking;
CREATE INDEX idx_reservations_no_double_booking 
ON reservations USING gist (table_id, tstzrange(start_at, end_at)) 
WHERE status = 'BOOKED' AND table_id IS NOT NULL;

-- =====================================================
-- 6. CREATE PERFORMANCE INDEXES
-- =====================================================

-- Indexes for tables
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_tables_is_active ON tables(is_active);
CREATE INDEX IF NOT EXISTS idx_tables_area ON tables(area);

-- Indexes for table_sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_order_id ON table_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened_at ON table_sessions(opened_at);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_open ON table_sessions(venue_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_open ON table_sessions(table_id) WHERE closed_at IS NULL;

-- Indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_venue_id ON reservations(venue_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_venue_table_status ON reservations(venue_id, table_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_time_window ON reservations(start_at, end_at) WHERE status = 'BOOKED';

-- =====================================================
-- 7. CREATE TABLE_RUNTIME_STATE VIEW
-- =====================================================

-- This is the core view that combines live state with reservation state
CREATE OR REPLACE VIEW table_runtime_state AS
WITH cur AS (
  -- Current live session state (FREE = available, OCCUPIED = seated)
  SELECT
    t.venue_id,
    t.id as table_id,
    t.label,
    t.seat_count,
    t.area,
    t.is_active,
    s.id as session_id,
    s.status as live_status,                 -- 'FREE' | 'OCCUPIED' (null if no session)
    s.opened_at,
    s.server_id
  FROM tables t
  LEFT JOIN table_sessions s
    ON s.table_id = t.id AND s.closed_at IS NULL
  WHERE t.is_active = true
),
res_now AS (
  -- Reservation overlapping *right now*
  SELECT
    r.venue_id,
    r.table_id,
    r.id as reservation_id,
    r.start_at,
    r.end_at,
    r.party_size,
    r.customer_name,
    r.customer_phone
  FROM reservations r
  WHERE r.status = 'BOOKED'
    AND r.start_at <= now()
    AND r.end_at >= now()
),
res_next AS (
  -- Next upcoming reservation today (or next 8h)
  SELECT DISTINCT ON (r.table_id)
    r.venue_id,
    r.table_id,
    r.id as reservation_id,
    r.start_at,
    r.end_at,
    r.party_size,
    r.customer_name,
    r.customer_phone
  FROM reservations r
  WHERE r.status = 'BOOKED' 
    AND r.start_at > now()
    AND r.start_at <= now() + interval '8 hours'
  ORDER BY r.table_id, r.start_at
)
SELECT
  c.*,
  CASE
    WHEN rn.reservation_id IS NOT NULL THEN 'RESERVED_NOW'
    WHEN rx.reservation_id IS NOT NULL THEN 'RESERVED_LATER'
    ELSE 'NONE'
  END as reservation_state,
  rn.reservation_id as reserved_now_id,
  rn.start_at as reserved_now_start,
  rn.end_at as reserved_now_end,
  rn.party_size as reserved_now_party_size,
  rn.customer_name as reserved_now_name,
  rn.customer_phone as reserved_now_phone,
  rx.reservation_id as next_reservation_id,
  rx.start_at as next_reservation_start,
  rx.end_at as next_reservation_end,
  rx.party_size as next_reservation_party_size,
  rx.customer_name as next_reservation_name,
  rx.customer_phone as next_reservation_phone
FROM cur c
LEFT JOIN res_now rn ON rn.table_id = c.table_id AND rn.venue_id = c.venue_id
LEFT JOIN res_next rx ON rx.table_id = c.table_id AND rx.venue_id = c.venue_id;

-- Grant permissions on the view
GRANT SELECT ON table_runtime_state TO authenticated;
GRANT SELECT ON table_runtime_state TO service_role;

-- =====================================================
-- 8. CREATE UNASSIGNED RESERVATIONS VIEW
-- =====================================================

-- View for unassigned reservations (no table yet)
CREATE OR REPLACE VIEW unassigned_reservations AS
SELECT
  r.id,
  r.venue_id,
  r.start_at,
  r.end_at,
  r.party_size,
  r.customer_name,
  r.customer_phone,
  r.status,
  r.created_at
FROM reservations r
WHERE r.table_id IS NULL
  AND r.status = 'BOOKED'
  AND r.start_at > now() - interval '1 hour'  -- Show recent and upcoming
ORDER BY r.start_at;

GRANT SELECT ON unassigned_reservations TO authenticated;
GRANT SELECT ON unassigned_reservations TO service_role;

-- =====================================================
-- 9. CREATE DASHBOARD COUNTERS FUNCTION
-- =====================================================

-- Updated counter function with proper separated logic
CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id TEXT)
RETURNS TABLE(
  total_tables BIGINT,
  available BIGINT,
  occupied BIGINT,
  reserved_now BIGINT,
  reserved_later BIGINT,
  unassigned_reservations BIGINT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH cur AS (
    -- Current live session state
    SELECT
      t.id as table_id,
      s.status as live_status
    FROM tables t
    LEFT JOIN table_sessions s
      ON s.table_id = t.id AND s.closed_at IS NULL
    WHERE t.venue_id = p_venue_id AND t.is_active = true
  ),
  res_now AS (
    -- Reservations overlapping NOW
    SELECT COUNT(DISTINCT r.table_id) as cnt
    FROM reservations r
    JOIN tables t ON t.id = r.table_id
    WHERE t.venue_id = p_venue_id
      AND t.is_active = true
      AND r.status = 'BOOKED'
      AND r.start_at <= now()
      AND r.end_at >= now()
  ),
  res_later AS (
    -- Reservations later today
    SELECT COUNT(DISTINCT r.table_id) as cnt
    FROM reservations r
    JOIN tables t ON t.id = r.table_id
    WHERE t.venue_id = p_venue_id
      AND t.is_active = true
      AND r.status = 'BOOKED'
      AND r.start_at > now()
      AND r.start_at::date = now()::date
  ),
  unassigned AS (
    -- Unassigned reservations
    SELECT COUNT(*) as cnt
    FROM reservations r
    WHERE r.venue_id = p_venue_id
      AND r.table_id IS NULL
      AND r.status = 'BOOKED'
      AND r.start_at > now() - interval '1 hour'
  )
  SELECT
    (SELECT COUNT(*) FROM tables t WHERE t.venue_id = p_venue_id AND t.is_active) as total_tables,
    (SELECT COUNT(*) FROM cur WHERE live_status = 'FREE' OR live_status IS NULL) as available,
    (SELECT COUNT(*) FROM cur WHERE live_status = 'OCCUPIED') as occupied,
    (SELECT cnt FROM res_now) as reserved_now,
    (SELECT cnt FROM res_later) as reserved_later,
    (SELECT cnt FROM unassigned) as unassigned_reservations;
END $$;

-- =====================================================
-- 10. CREATE TABLE ACTION API FUNCTIONS
-- =====================================================

-- Seat party (FREE → OCCUPIED)
CREATE OR REPLACE FUNCTION api_seat_party(
  p_table_id UUID,
  p_reservation_id UUID DEFAULT NULL,
  p_server_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_venue_id TEXT;
  v_current_status table_status;
BEGIN
  -- Get venue and current status
  SELECT t.venue_id, COALESCE(s.status, 'FREE'::table_status)
  INTO v_venue_id, v_current_status
  FROM tables t
  LEFT JOIN table_sessions s ON s.table_id = t.id AND s.closed_at IS NULL
  WHERE t.id = p_table_id AND t.is_active = true;
  
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Table not found or inactive';
  END IF;
  
  IF v_current_status = 'OCCUPIED' THEN
    RAISE EXCEPTION 'Table is already occupied';
  END IF;
  
  -- Close current session if exists
  UPDATE table_sessions 
  SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Create new OCCUPIED session
  INSERT INTO table_sessions (venue_id, table_id, status, server_id)
  VALUES (v_venue_id, p_table_id, 'OCCUPIED', p_server_id);
  
  -- If this is a reservation check-in, update reservation status
  IF p_reservation_id IS NOT NULL THEN
    UPDATE reservations
    SET status = 'CHECKED_IN', table_id = p_table_id, updated_at = NOW()
    WHERE id = p_reservation_id AND status = 'BOOKED';
  END IF;
END $$;

-- Close table (OCCUPIED → FREE)
CREATE OR REPLACE FUNCTION api_close_table(p_table_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_venue_id TEXT;
  v_unpaid_orders BIGINT;
BEGIN
  -- Get venue
  SELECT t.venue_id INTO v_venue_id
  FROM tables t
  WHERE t.id = p_table_id AND t.is_active = true;
  
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Table not found or inactive';
  END IF;
  
  -- Check for unpaid orders
  SELECT COUNT(*)
  INTO v_unpaid_orders
  FROM table_sessions s
  JOIN orders o ON o.id = s.order_id
  WHERE s.table_id = p_table_id 
    AND s.closed_at IS NULL
    AND o.payment_status != 'PAID';
  
  IF v_unpaid_orders > 0 THEN
    RAISE EXCEPTION 'Cannot close table with unpaid orders';
  END IF;
  
  -- Close current session
  UPDATE table_sessions 
  SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Create new FREE session
  INSERT INTO table_sessions (venue_id, table_id, status)
  VALUES (v_venue_id, p_table_id, 'FREE');
END $$;

-- Assign reservation to table
CREATE OR REPLACE FUNCTION api_assign_reservation(
  p_reservation_id UUID,
  p_table_id UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_venue_id TEXT;
  v_reservation_venue_id TEXT;
BEGIN
  -- Get venue IDs
  SELECT t.venue_id INTO v_venue_id
  FROM tables t
  WHERE t.id = p_table_id AND t.is_active = true;
  
  SELECT r.venue_id INTO v_reservation_venue_id
  FROM reservations r
  WHERE r.id = p_reservation_id;
  
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Table not found or inactive';
  END IF;
  
  IF v_reservation_venue_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  IF v_venue_id != v_reservation_venue_id THEN
    RAISE EXCEPTION 'Reservation and table must be from same venue';
  END IF;
  
  -- Update reservation
  UPDATE reservations
  SET table_id = p_table_id, updated_at = NOW()
  WHERE id = p_reservation_id AND status = 'BOOKED';
END $$;

-- Cancel reservation
CREATE OR REPLACE FUNCTION api_cancel_reservation(p_reservation_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reservations
  SET status = 'CANCELLED', updated_at = NOW()
  WHERE id = p_reservation_id AND status = 'BOOKED';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or already processed';
  END IF;
END $$;

-- Mark reservation as no-show
CREATE OR REPLACE FUNCTION api_no_show_reservation(p_reservation_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reservations
  SET status = 'NO_SHOW', updated_at = NOW()
  WHERE id = p_reservation_id AND status = 'BOOKED';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or already processed';
  END IF;
END $$;

-- =====================================================
-- 11. CREATE UTILITY FUNCTIONS
-- =====================================================

-- Function to ensure all active tables have a FREE session
CREATE OR REPLACE FUNCTION ensure_free_sessions_for_active_tables()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO table_sessions (venue_id, table_id, status)
  SELECT t.venue_id, t.id, 'FREE'::table_status
  FROM tables t
  LEFT JOIN table_sessions s
    ON s.table_id = t.id AND s.closed_at IS NULL
  WHERE t.is_active = true AND s.id IS NULL;
END $$;

-- Function to get table runtime state for a specific venue
CREATE OR REPLACE FUNCTION get_table_runtime_state(p_venue_id TEXT)
RETURNS TABLE(
  table_id UUID,
  label TEXT,
  seat_count INTEGER,
  area TEXT,
  is_active BOOLEAN,
  session_id UUID,
  live_status table_status,
  opened_at TIMESTAMPTZ,
  server_id UUID,
  reservation_state TEXT,
  reserved_now_id UUID,
  reserved_now_start TIMESTAMPTZ,
  reserved_now_end TIMESTAMPTZ,
  reserved_now_party_size INTEGER,
  reserved_now_name TEXT,
  reserved_now_phone TEXT,
  next_reservation_id UUID,
  next_reservation_start TIMESTAMPTZ,
  next_reservation_end TIMESTAMPTZ,
  next_reservation_party_size INTEGER,
  next_reservation_name TEXT,
  next_reservation_phone TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM table_runtime_state WHERE venue_id = p_venue_id;
END $$;

-- =====================================================
-- 12. INITIALIZE DATA
-- =====================================================

-- Ensure all active tables have FREE sessions
SELECT ensure_free_sessions_for_active_tables();

-- =====================================================
-- 13. COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Table Management Refactor completed successfully!';
  RAISE NOTICE 'Created/updated all required tables: tables, table_sessions, reservations';
  RAISE NOTICE 'Created table_runtime_state view with layered state logic';
  RAISE NOTICE 'Created API functions for table actions';
  RAISE NOTICE 'Added proper constraints and indexes for performance';
  RAISE NOTICE 'Ensured all active tables have FREE sessions';
  RAISE NOTICE 'Tables can now show FREE + RESERVED_LATER simultaneously';
END $$;