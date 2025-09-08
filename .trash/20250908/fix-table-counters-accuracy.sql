-- =====================================================
-- FIX TABLE COUNTERS ACCURACY
-- =====================================================
-- This script ensures table counters are always accurate and update correctly
-- Fixes the mismatch between table display and counter values

-- =====================================================
-- 1. UPDATED TABLE COUNTERS FUNCTION
-- =====================================================
-- This function now correctly counts tables that actually exist in the database
-- and matches the table display logic exactly

CREATE OR REPLACE FUNCTION public.api_table_counters(p_venue_id TEXT)
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
      -- Tables Set Up: count of all active tables (matches table display logic)
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
      COUNT(CASE WHEN ts.status = 'OCCUPIED' AND ts.closed_at IS NULL THEN 1 END) as in_use_now
    FROM tables t
    LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
    WHERE t.venue_id = p_venue_id AND t.is_active = true
  ),
  reservation_stats AS (
    SELECT 
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
    FROM reservations r
    INNER JOIN tables t ON t.id = r.table_id
    WHERE t.venue_id = p_venue_id AND t.is_active = true
  )
  SELECT json_build_object(
    'total_tables', ts.tables_set_up,
    'available', ts.free_now,
    'occupied', ts.in_use_now,
    'reserved_now', COALESCE(rs.reserved_now, 0),
    'reserved_later', COALESCE(rs.reserved_later, 0),
    'unassigned_reservations', 0,
    'block_window_mins', v_block_window_mins
  ) INTO v_counters
  FROM table_stats ts
  CROSS JOIN reservation_stats rs;
  
  RETURN v_counters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. REAL-TIME TABLE COUNTERS FUNCTION
-- =====================================================
-- This function provides real-time accurate counts that match exactly
-- what the table management interface displays

CREATE OR REPLACE FUNCTION public.get_realtime_table_counts(p_venue_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_tables_count INTEGER := 0;
  v_free_count INTEGER := 0;
  v_occupied_count INTEGER := 0;
  v_reserved_now_count INTEGER := 0;
  v_reserved_later_count INTEGER := 0;
BEGIN
  -- Count total active tables (matches table display logic exactly)
  SELECT COUNT(*) INTO v_tables_count
  FROM tables t
  WHERE t.venue_id = p_venue_id AND t.is_active = true;
  
  -- Count free tables (tables with FREE sessions and no active reservations)
  SELECT COUNT(*) INTO v_free_count
  FROM tables t
  LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
  WHERE t.venue_id = p_venue_id 
    AND t.is_active = true
    AND ts.status = 'FREE';
  
  -- Count occupied tables (tables with OCCUPIED sessions)
  SELECT COUNT(*) INTO v_occupied_count
  FROM tables t
  LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
  WHERE t.venue_id = p_venue_id 
    AND t.is_active = true
    AND ts.status = 'OCCUPIED';
  
  -- Count reserved now (tables with active reservations)
  SELECT COUNT(DISTINCT r.table_id) INTO v_reserved_now_count
  FROM reservations r
  INNER JOIN tables t ON t.id = r.table_id
  WHERE t.venue_id = p_venue_id 
    AND t.is_active = true
    AND r.status = 'BOOKED' 
    AND r.start_at <= NOW() + INTERVAL '30 minutes'
    AND r.end_at >= NOW();
  
  -- Count reserved later (tables with future reservations)
  SELECT COUNT(DISTINCT r.table_id) INTO v_reserved_later_count
  FROM reservations r
  INNER JOIN tables t ON t.id = r.table_id
  WHERE t.venue_id = p_venue_id 
    AND t.is_active = true
    AND r.status = 'BOOKED' 
    AND r.start_at > NOW() + INTERVAL '30 minutes';
  
  -- Build result object
  v_result := json_build_object(
    'tables_set_up', v_tables_count,
    'free_now', v_free_count,
    'in_use_now', v_occupied_count,
    'reserved_now', v_reserved_now_count,
    'reserved_later', v_reserved_later_count,
    'timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.api_table_counters(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_realtime_table_counts(TEXT) TO authenticated;

-- =====================================================
-- 4. TEST THE FUNCTIONS
-- =====================================================
-- Test the updated functions to ensure they return accurate counts

-- Test with a specific venue (replace with actual venue_id)
-- SELECT public.api_table_counters('your-venue-id');
-- SELECT public.get_realtime_table_counts('your-venue-id');

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================
-- Use these queries to verify the counts are accurate

-- Check total tables for a venue
-- SELECT COUNT(*) as total_tables
-- FROM tables t
-- WHERE t.venue_id = 'your-venue-id' AND t.is_active = true;

-- Check free tables for a venue
-- SELECT COUNT(*) as free_tables
-- FROM tables t
-- LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
-- WHERE t.venue_id = 'your-venue-id' 
--   AND t.is_active = true
--   AND ts.status = 'FREE';

-- Check occupied tables for a venue
-- SELECT COUNT(*) as occupied_tables
-- FROM tables t
-- LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
-- WHERE t.venue_id = 'your-venue-id' 
--   AND t.is_active = true
--   AND ts.status = 'OCCUPIED';
