-- Fix table counters function field names to match frontend expectations
-- This fixes the issue where counters were showing 0 due to field name mismatch

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
      -- Tables Set Up: count of all active tables (regardless of status)
      COUNT(*) as tables_set_up,
      
      -- Free Now: tables whose live session is FREE (no active reservations)
      COUNT(CASE 
        WHEN ts.status = 'FREE' 
          AND ts.closed_at IS NULL 
          AND NOT EXISTS (
            SELECT 1 FROM reservations r 
            WHERE r.table_id = t.id 
            AND r.status = 'BOOKED' 
            AND r.start_at <= NOW() + (v_block_window_mins || ' minutes')::INTERVAL
            AND r.end_at >= NOW()
          )
        THEN 1 
      END) as free_now,
      
      -- In Use Now: tables whose live session is OCCUPIED
      COUNT(CASE WHEN ts.status = 'OCCUPIED' AND ts.closed_at IS NULL THEN 1 END) as in_use_now,
      
      -- Reserved Now: tables with active reservations (can be FREE or OCCUPIED)
      COUNT(DISTINCT CASE 
        WHEN r.status = 'BOOKED' 
          AND r.start_at <= NOW() + (v_block_window_mins || ' minutes')::INTERVAL
          AND r.end_at >= NOW()
        THEN r.table_id 
      END) as reserved_now,
      
      -- Reserved Later: tables with future reservations (can be FREE or OCCUPIED)
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
-- REMOVE TABLE FUNCTION
-- =====================================================
-- Removes a table entirely (soft delete by setting is_active = false)

CREATE OR REPLACE FUNCTION api_remove_table(
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
    RETURN json_build_object('success', false, 'error', 'Table not found or already removed');
  END IF;
  
  -- Close any existing session
  UPDATE table_sessions 
  SET closed_at = NOW(), updated_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;
  
  -- Soft delete the table
  UPDATE tables 
  SET is_active = false, updated_at = NOW()
  WHERE id = p_table_id;
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'table_id', p_table_id,
    'table_label', v_table.label,
    'message', 'Table removed successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION api_remove_table(UUID, TEXT) TO authenticated;
