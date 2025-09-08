-- Deploy essential table management functions
-- Run this in your Supabase SQL editor

-- 1. Create table_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
        CREATE TYPE table_status AS ENUM ('FREE', 'OCCUPIED');
    END IF;
END $$;

-- 2. Create reservation_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE reservation_status AS ENUM ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW');
    END IF;
END $$;

-- 3. Drop and recreate api_table_counters function
DROP FUNCTION IF EXISTS api_table_counters(TEXT);

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
  SELECT 
    COUNT(*) as total_tables,
    COUNT(CASE WHEN COALESCE(s.status, 'FREE'::table_status) = 'FREE' THEN 1 END) as available,
    COUNT(CASE WHEN s.status = 'OCCUPIED' THEN 1 END) as occupied,
    COUNT(CASE WHEN r.status = 'BOOKED' AND r.start_at <= now() AND r.end_at >= now() THEN 1 END) as reserved_now,
    COUNT(CASE WHEN r.status = 'BOOKED' AND r.start_at > now() THEN 1 END) as reserved_later,
    (SELECT COUNT(*) FROM reservations WHERE venue_id = p_venue_id AND status = 'BOOKED' AND table_id IS NULL) as unassigned_reservations
  FROM tables t
  LEFT JOIN table_sessions s ON s.table_id = t.id AND s.closed_at IS NULL
  LEFT JOIN reservations r ON r.table_id = t.id AND r.status = 'BOOKED'
  WHERE t.venue_id = p_venue_id AND t.is_active = true;
END $$;

-- 4. Drop and recreate api_seat_party function
DROP FUNCTION IF EXISTS api_seat_party(UUID, UUID, UUID);

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
  
  IF v_current_status != 'FREE' THEN
    RAISE EXCEPTION 'Table is not available for seating';
  END IF;
  
  -- Close any existing session
  UPDATE table_sessions 
  SET closed_at = NOW() 
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Create new OCCUPIED session
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at, server_id)
  VALUES (v_venue_id, p_table_id, 'OCCUPIED', NOW(), p_server_id);
  
  -- If there's a reservation, mark it as CHECKED_IN
  IF p_reservation_id IS NOT NULL THEN
    UPDATE reservations 
    SET status = 'CHECKED_IN' 
    WHERE id = p_reservation_id AND status = 'BOOKED';
  END IF;
END $$;

-- 5. Drop and recreate api_close_table function
DROP FUNCTION IF EXISTS api_close_table(UUID);

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
  SELECT COUNT(*) INTO v_unpaid_orders
  FROM orders o
  WHERE o.venue_id = v_venue_id 
    AND o.table_number = (SELECT label FROM tables WHERE id = p_table_id)
    AND o.payment_status = 'UNPAID'
    AND o.order_status NOT IN ('COMPLETED', 'CANCELLED');
  
  IF v_unpaid_orders > 0 THEN
    RAISE EXCEPTION 'Cannot close table with unpaid orders';
  END IF;
  
  -- Close current session
  UPDATE table_sessions 
  SET closed_at = NOW() 
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Create new FREE session
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
  VALUES (v_venue_id, p_table_id, 'FREE', NOW());
END $$;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION api_table_counters(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api_seat_party(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api_close_table(UUID) TO authenticated;

-- 7. Test the functions
SELECT 'Functions deployed successfully!' as status;

-- 8. Test counters (replace with your actual venue_id)
-- SELECT * FROM api_table_counters('your-venue-id');
