-- =====================================================
-- TABLE MANAGEMENT API FUNCTIONS
-- =====================================================
-- Comprehensive API functions for the improved table management system

-- =====================================================
-- 1. SEAT PARTY FUNCTION
-- =====================================================
-- Handles the complete "Seat Party" flow:
-- - Marks table as OCCUPIED
-- - Creates/updates session
-- - Optionally assigns reservation
-- - Returns QR code data for popup

CREATE OR REPLACE FUNCTION api_seat_party(
  p_table_id UUID,
  p_venue_id TEXT,
  p_reservation_id UUID DEFAULT NULL,
  p_server_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_table RECORD;
  v_session_id UUID;
  v_qr_data JSON;
  v_result JSON;
BEGIN
  -- Get table details
  SELECT * INTO v_table
  FROM tables 
  WHERE id = p_table_id AND venue_id = p_venue_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or inactive');
  END IF;
  
  -- Close any existing session
  UPDATE table_sessions 
  SET closed_at = NOW(), updated_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Create new OCCUPIED session
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at, server_id)
  VALUES (p_venue_id, p_table_id, 'OCCUPIED', NOW(), p_server_id)
  RETURNING id INTO v_session_id;
  
  -- If reservation provided, mark as checked in
  IF p_reservation_id IS NOT NULL THEN
    UPDATE reservations 
    SET status = 'CHECKED_IN', updated_at = NOW()
    WHERE id = p_reservation_id AND table_id = p_table_id;
  END IF;
  
  -- Generate QR code data for popup
  v_qr_data := json_build_object(
    'table_id', p_table_id,
    'table_label', v_table.label,
    'venue_id', p_venue_id,
    'session_id', v_session_id,
    'qr_url', format('https://servio.app/order?venue=%s&table=%s', p_venue_id, v_table.label),
    'timestamp', NOW()
  );
  
  -- Return success with QR data
  v_result := json_build_object(
    'success', true,
    'table_id', p_table_id,
    'table_label', v_table.label,
    'session_id', v_session_id,
    'qr_data', v_qr_data,
    'message', 'Party seated successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CLOSE TABLE FUNCTION
-- =====================================================
-- Closes a table session and returns it to FREE state

CREATE OR REPLACE FUNCTION api_close_table(
  p_table_id UUID,
  p_venue_id TEXT
)
RETURNS JSON AS $$
DECLARE
  v_table RECORD;
  v_result JSON;
BEGIN
  -- Get table details
  SELECT * INTO v_table
  FROM tables 
  WHERE id = p_table_id AND venue_id = p_venue_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or inactive');
  END IF;
  
  -- Close current session
  UPDATE table_sessions 
  SET closed_at = NOW(), updated_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Create new FREE session
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
  VALUES (p_venue_id, p_table_id, 'FREE', NOW());
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'table_id', p_table_id,
    'table_label', v_table.label,
    'message', 'Table closed and returned to free state'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TABLE COUNTERS FUNCTION
-- =====================================================
-- Returns comprehensive table state counters

CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_counters JSON;
  v_venue RECORD;
  v_block_window_mins INTEGER;
BEGIN
  -- Get venue business type to determine blocking window
  SELECT business_type, reservation_blocking_minutes INTO v_venue
  FROM venues 
  WHERE venue_id = p_venue_id;
  
  -- Determine effective blocking window
  IF v_venue.reservation_blocking_minutes IS NOT NULL THEN
    v_block_window_mins := v_venue.reservation_blocking_minutes;
  ELSIF v_venue.business_type = 'RESTAURANT' THEN
    v_block_window_mins := 30;
  ELSE
    v_block_window_mins := 0; -- CAFE or default
  END IF;

  WITH table_stats AS (
    SELECT 
      -- Tables Set Up: count(tables where is_active=true)
      COUNT(*) as tables_set_up,
      
      -- Free Now: tables whose live session is FREE
      COUNT(CASE WHEN ts.status = 'FREE' AND ts.closed_at IS NULL THEN 1 END) as free_now,
      
      -- In Use Now: tables whose live session is OCCUPIED
      COUNT(CASE WHEN ts.status = 'OCCUPIED' AND ts.closed_at IS NULL THEN 1 END) as in_use_now,
      
      -- Reserved Now: tables with BOOKED reservation within blocking window
      COUNT(DISTINCT CASE 
        WHEN r.status = 'BOOKED' 
          AND r.start_at <= NOW() + (v_block_window_mins || ' minutes')::INTERVAL
          AND r.end_at >= NOW()
        THEN r.table_id 
      END) as reserved_now,
      
      -- Reserved Later: tables with next BOOKED reservation after blocking window
      COUNT(DISTINCT CASE 
        WHEN r.status = 'BOOKED' 
          AND r.start_at > NOW() + (v_block_window_mins || ' minutes')::INTERVAL
        THEN r.table_id 
      END) as reserved_later
    FROM tables t
    LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
    LEFT JOIN reservations r ON r.table_id = t.id AND r.status = 'BOOKED'
    WHERE t.venue_id = p_venue_id AND t.is_active = true
  )
  SELECT json_build_object(
    'total_tables', tables_set_up,
    'available', free_now,
    'occupied', in_use_now,
    'reserved_now', reserved_now,
    'reserved_later', reserved_later,
    'unassigned_reservations', 0,
    'block_window_mins', v_block_window_mins
  ) INTO v_counters
  FROM table_stats;
  
  RETURN v_counters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TABLE RUNTIME STATE VIEW
-- =====================================================
-- Comprehensive view showing current state of all tables

-- Drop the existing view first to avoid column conflicts
DROP VIEW IF EXISTS table_runtime_state;

CREATE VIEW table_runtime_state AS
SELECT 
  t.id as table_id,
  t.venue_id,
  t.label,
  t.seat_count,
  t.area,
  t.is_active,
  
  -- Current session state
  ts.id as session_id,
  ts.status as primary_status,
  ts.opened_at,
  ts.server_id,
  
  -- Venue blocking window
  COALESCE(v.reservation_blocking_minutes, 
    CASE WHEN v.business_type = 'RESTAURANT' THEN 30 ELSE 0 END
  ) as block_window_mins,
  
  -- Reservation state (business type aware)
  CASE 
    WHEN r_now.id IS NOT NULL THEN 'RESERVED_NOW'
    WHEN r_later.id IS NOT NULL THEN 'RESERVED_LATER'
    ELSE 'NONE'
  END as reservation_status,
  
  -- Current reservation (within blocking window)
  r_now.id as reserved_now_id,
  r_now.start_at as reserved_now_start,
  r_now.end_at as reserved_now_end,
  r_now.party_size as reserved_now_party_size,
  r_now.customer_name as reserved_now_name,
  r_now.customer_phone as reserved_now_phone,
  
  -- Next reservation (after blocking window)
  r_later.id as next_reservation_id,
  r_later.start_at as next_reservation_start,
  r_later.end_at as next_reservation_end,
  r_later.party_size as next_reservation_party_size,
  r_later.customer_name as next_reservation_name,
  r_later.customer_phone as next_reservation_phone,
  
  -- Order info (if any)
  o.id as order_id,
  o.customer_name,
  o.total_amount,
  o.order_status,
  
  t.created_at,
  t.updated_at
FROM tables t
LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
LEFT JOIN venues v ON v.venue_id = t.venue_id
LEFT JOIN reservations r_now ON r_now.table_id = t.id 
  AND r_now.status = 'BOOKED' 
  AND r_now.start_at <= NOW() + COALESCE(v.reservation_blocking_minutes, 
    CASE WHEN v.business_type = 'RESTAURANT' THEN 30 ELSE 0 END
  ) * INTERVAL '1 minute'
  AND r_now.end_at >= NOW()
LEFT JOIN reservations r_later ON r_later.table_id = t.id 
  AND r_later.status = 'BOOKED' 
  AND r_later.start_at > NOW() + COALESCE(v.reservation_blocking_minutes, 
    CASE WHEN v.business_type = 'RESTAURANT' THEN 30 ELSE 0 END
  ) * INTERVAL '1 minute'
  AND (r_now.id IS NULL OR r_later.start_at > r_now.start_at)
LEFT JOIN orders o ON o.table_number = CAST(t.label AS INTEGER) 
  AND o.venue_id = t.venue_id 
  AND o.order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING')
WHERE t.is_active = true;

-- =====================================================
-- 5. WAITING LIST FUNCTIONS
-- =====================================================
-- Functions to manage waiting parties

CREATE OR REPLACE FUNCTION api_add_to_waiting_list(
  p_venue_id TEXT,
  p_customer_name TEXT,
  p_party_size INTEGER DEFAULT 2,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_waiting_id UUID;
  v_result JSON;
BEGIN
  -- Create waiting list entry
  INSERT INTO waiting_list (venue_id, customer_name, party_size, customer_phone, created_at)
  VALUES (p_venue_id, p_customer_name, p_party_size, p_customer_phone, NOW())
  RETURNING id INTO v_waiting_id;
  
  v_result := json_build_object(
    'success', true,
    'waiting_id', v_waiting_id,
    'customer_name', p_customer_name,
    'party_size', p_party_size,
    'message', 'Added to waiting list'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION api_seat_party(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api_close_table(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api_table_counters(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api_add_to_waiting_list(TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT SELECT ON table_runtime_state TO authenticated;
