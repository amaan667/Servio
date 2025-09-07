-- =====================================================
-- TABLE MANAGEMENT REFACTOR
-- =====================================================
-- Implements layered state: live sessions + reservations
-- Fixes "last action wins" bug and enables proper venue operations

-- =====================================================
-- 0. DROP EXISTING VIEWS (must be done first)
-- =====================================================

-- Drop existing views that depend on the status column
DROP VIEW IF EXISTS table_runtime_state CASCADE;
DROP VIEW IF EXISTS tables_with_sessions CASCADE;

-- =====================================================
-- 1. UPDATE TABLE_SESSIONS SCHEMA
-- =====================================================

-- Update table_sessions to use proper status enum
-- Primary states: FREE (available for seating) and OCCUPIED (currently seated)
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

-- Add server_id column for tracking who opened the session
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- =====================================================
-- 2. UPDATE RESERVATIONS SCHEMA
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
-- 3. CREATE TABLE_RUNTIME_STATE VIEW
-- =====================================================

-- Create the new table_runtime_state view that combines primary state and reservations
-- PRIMARY STATE: FREE (available) or OCCUPIED (seated)
-- SECONDARY LAYER: Reservation status underneath
CREATE OR REPLACE VIEW table_runtime_state AS
WITH cur AS (
  -- Primary table state (FREE = available for seating, OCCUPIED = currently seated)
  SELECT
    t.venue_id,
    t.id as table_id,
    t.label,
    t.seat_count,
    t.is_active,
    s.id as session_id,
    s.status as primary_status,              -- 'FREE' | 'OCCUPIED' (primary state)
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
    r.name,
    r.phone
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
    r.name,
    r.phone
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
  rn.party_size as reserved_now_party_size,
  rn.name as reserved_now_name,
  rn.phone as reserved_now_phone,
  rx.reservation_id as next_reservation_id,
  rx.start_at as next_reservation_start,
  rx.end_at as next_reservation_end,
  rx.party_size as next_reservation_party_size,
  rx.name as next_reservation_name,
  rx.phone as next_reservation_phone
FROM cur c
LEFT JOIN res_now rn ON rn.table_id = c.table_id AND rn.venue_id = c.venue_id
LEFT JOIN res_next rx ON rx.table_id = c.table_id AND rx.venue_id = c.venue_id;

-- Grant permissions on the view
GRANT SELECT ON table_runtime_state TO authenticated;
GRANT SELECT ON table_runtime_state TO service_role;

-- =====================================================
-- 4. CREATE UNASSIGNED RESERVATIONS VIEW
-- =====================================================

-- View for unassigned reservations (no table yet)
CREATE OR REPLACE VIEW unassigned_reservations AS
SELECT
  r.id,
  r.venue_id,
  r.start_at,
  r.end_at,
  r.party_size,
  r.name,
  r.phone,
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
-- 5. UPDATE DASHBOARD COUNTERS
-- =====================================================

-- Drop existing counter functions
DROP FUNCTION IF EXISTS api_table_counters(UUID);
DROP FUNCTION IF EXISTS get_table_counts(TEXT);

-- Create new counter function with proper logic
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
-- 6. CREATE TABLE ACTIONS API FUNCTIONS
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
-- 7. CREATE PROPER INDEXES
-- =====================================================

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_venue_table_status 
ON reservations(venue_id, table_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_time_window 
ON reservations(start_at, end_at) WHERE status = 'BOOKED';

CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_open 
ON table_sessions(venue_id) WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_table_sessions_table_open 
ON table_sessions(table_id) WHERE closed_at IS NULL;

-- =====================================================
-- 8. ENSURE FREE SESSIONS FOR ALL ACTIVE TABLES
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

-- Run the function to ensure all tables have sessions
SELECT ensure_free_sessions_for_active_tables();

-- =====================================================
-- 9. COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Table Management Refactor completed successfully!';
  RAISE NOTICE 'Created table_runtime_state view with layered state logic';
  RAISE NOTICE 'Updated dashboard counters with proper business logic';
  RAISE NOTICE 'Created API functions for table actions';
  RAISE NOTICE 'Added proper indexes for performance';
END $$;
