-- =====================================================
-- TABLE MANAGEMENT REFACTOR - FINAL VERSION
-- =====================================================
-- This script handles everything in the correct order

-- =====================================================
-- 0. DROP EXISTING VIEWS (must be done first)
-- =====================================================

DROP VIEW IF EXISTS table_runtime_state CASCADE;
DROP VIEW IF EXISTS tables_with_sessions CASCADE;

-- =====================================================
-- 1. CREATE TABLES IF THEY DON'T EXIST
-- =====================================================

-- Create tables table if it doesn't exist
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  seat_count INTEGER NOT NULL DEFAULT 2,
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
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reservations table if it doesn't exist
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

-- =====================================================
-- 2. ADD MISSING COLUMNS
-- =====================================================

-- Add status column to table_sessions if it doesn't exist
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'FREE' 
CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED'));

-- Add server_id column to table_sessions if it doesn't exist
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update any existing rows to have a default status
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL;

-- Make status column NOT NULL after setting defaults
ALTER TABLE table_sessions 
ALTER COLUMN status SET NOT NULL;

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

-- Indexes for tables
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_tables_is_active ON tables(is_active);

-- Indexes for table_sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_order_id ON table_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened_at ON table_sessions(opened_at);

-- Indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_venue_id ON reservations(venue_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- =====================================================
-- 4. UPDATE TABLE_SESSIONS SCHEMA
-- =====================================================

-- Update table_sessions to use proper status enum
DROP TYPE IF EXISTS table_status CASCADE;
CREATE TYPE table_status AS ENUM ('FREE', 'OCCUPIED');

-- Update table_sessions table to use the new enum
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS table_sessions_status_check;

-- Remove the default value to avoid casting issues
ALTER TABLE table_sessions 
ALTER COLUMN status DROP DEFAULT;

-- First, update existing data to map to new enum values
UPDATE table_sessions 
SET status = CASE 
  WHEN status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL') THEN 'FREE'
  WHEN status IN ('OCCUPIED', 'RESERVED', 'CLOSED') THEN 'OCCUPIED'
  ELSE 'FREE'  -- Default fallback
END;

-- Now change the column type
ALTER TABLE table_sessions 
ALTER COLUMN status TYPE table_status USING status::table_status;

-- Set the new default value
ALTER TABLE table_sessions 
ALTER COLUMN status SET DEFAULT 'FREE'::table_status;

-- =====================================================
-- 5. UPDATE RESERVATIONS SCHEMA
-- =====================================================

-- Update reservations to use proper status enum
DROP TYPE IF EXISTS reservation_status CASCADE;
CREATE TYPE reservation_status AS ENUM ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW');

-- Update reservations table to use the new enum
ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS reservations_status_check;

-- Remove the default value to avoid casting issues
ALTER TABLE reservations 
ALTER COLUMN status DROP DEFAULT;

-- First, update existing data to map to new enum values
UPDATE reservations 
SET status = CASE 
  WHEN status IN ('BOOKED', 'PENDING', 'CONFIRMED') THEN 'BOOKED'
  WHEN status IN ('CHECKED_IN', 'SEATED', 'ARRIVED') THEN 'CHECKED_IN'
  WHEN status IN ('CANCELLED', 'CANCELED') THEN 'CANCELLED'
  WHEN status IN ('NO_SHOW', 'NO-SHOW', 'NOSHOW') THEN 'NO_SHOW'
  ELSE 'BOOKED'  -- Default fallback
END;

-- Now change the column type
ALTER TABLE reservations 
ALTER COLUMN status TYPE reservation_status USING status::reservation_status;

-- Set the new default value
ALTER TABLE reservations 
ALTER COLUMN status SET DEFAULT 'BOOKED'::reservation_status;

-- Ensure table_id can be null for unassigned reservations
ALTER TABLE reservations 
ALTER COLUMN table_id DROP NOT NULL;

-- =====================================================
-- 6. CREATE TABLE_RUNTIME_STATE VIEW
-- =====================================================

CREATE OR REPLACE VIEW table_runtime_state AS
WITH cur AS (
  SELECT
    t.venue_id,
    t.id as table_id,
    t.label,
    t.seat_count,
    t.is_active,
    s.id as session_id,
    s.status as primary_status,
    s.opened_at,
    s.server_id
  FROM tables t
  LEFT JOIN table_sessions s
    ON s.table_id = t.id AND s.closed_at IS NULL
  WHERE t.is_active = true
),
res_now AS (
  SELECT
    r.venue_id,
    r.table_id,
    r.id as reservation_id,
    r.start_at,
    r.end_at,
    r.customer_name
  FROM reservations r
  WHERE r.status = 'BOOKED'
    AND r.start_at <= now()
    AND r.end_at >= now()
),
res_next AS (
  SELECT DISTINCT ON (r.table_id)
    r.venue_id,
    r.table_id,
    r.id as reservation_id,
    r.start_at,
    r.end_at,
    r.customer_name
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
  END as reservation_status,
  rn.reservation_id as reserved_now_id,
  rn.start_at as reserved_now_start,
  rn.end_at as reserved_now_end,
  rn.customer_name as reserved_now_name,
  rx.reservation_id as next_reservation_id,
  rx.start_at as next_reservation_start,
  rx.end_at as next_reservation_end,
  rx.customer_name as next_reservation_name
FROM cur c
LEFT JOIN res_now rn ON rn.table_id = c.table_id AND rn.venue_id = c.venue_id
LEFT JOIN res_next rx ON rx.table_id = c.table_id AND rx.venue_id = c.venue_id;

-- Grant permissions on the view
GRANT SELECT ON table_runtime_state TO authenticated;
GRANT SELECT ON table_runtime_state TO service_role;

-- =====================================================
-- 7. CREATE UNASSIGNED RESERVATIONS VIEW
-- =====================================================

CREATE OR REPLACE VIEW unassigned_reservations AS
SELECT
  r.id,
  r.venue_id,
  r.start_at,
  r.end_at,
  r.customer_name,
  r.status,
  r.created_at
FROM reservations r
WHERE r.table_id IS NULL
  AND r.status = 'BOOKED'
  AND r.start_at > now() - interval '1 hour'
ORDER BY r.start_at;

GRANT SELECT ON unassigned_reservations TO authenticated;
GRANT SELECT ON unassigned_reservations TO service_role;

-- =====================================================
-- 8. CREATE TABLE ACTIONS API FUNCTIONS
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
  
  UPDATE table_sessions 
  SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  INSERT INTO table_sessions (venue_id, table_id, status, server_id)
  VALUES (v_venue_id, p_table_id, 'OCCUPIED', p_server_id);
  
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
  SELECT t.venue_id INTO v_venue_id
  FROM tables t
  WHERE t.id = p_table_id AND t.is_active = true;
  
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Table not found or inactive';
  END IF;
  
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
  
  UPDATE table_sessions 
  SET closed_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
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
-- 9. ENSURE FREE SESSIONS FOR ALL ACTIVE TABLES
-- =====================================================

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

SELECT ensure_free_sessions_for_active_tables();
