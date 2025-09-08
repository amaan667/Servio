-- =====================================================
-- DAILY TABLE RESET SYSTEM
-- =====================================================
-- This script creates functions and scheduled jobs to automatically
-- reset all tables to FREE status at the start of each new day

-- =====================================================
-- 1. DAILY TABLE RESET FUNCTION
-- =====================================================
-- Closes all active table sessions and creates new FREE sessions
-- This effectively resets all tables to available state

CREATE OR REPLACE FUNCTION public.daily_table_reset()
RETURNS JSON AS $$
DECLARE
  v_reset_count INTEGER := 0;
  v_venue_count INTEGER := 0;
  v_result JSON;
  v_venue RECORD;
BEGIN
  -- Log the reset operation
  RAISE NOTICE '[DAILY RESET] Starting daily table reset at %', NOW();
  
  -- Get count of venues for logging
  SELECT COUNT(DISTINCT venue_id) INTO v_venue_count
  FROM tables 
  WHERE is_active = true;
  
  -- Close all active table sessions (both FREE and OCCUPIED)
  UPDATE table_sessions 
  SET closed_at = NOW(), updated_at = NOW()
  WHERE closed_at IS NULL;
  
  -- Get count of sessions that were closed
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Create new FREE sessions for all active tables
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
  SELECT 
    t.venue_id,
    t.id,
    'FREE',
    NOW()
  FROM tables t
  WHERE t.is_active = true;
  
  -- Log the results
  RAISE NOTICE '[DAILY RESET] Reset % table sessions across % venues', v_reset_count, v_venue_count;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'reset_sessions', v_reset_count,
    'venues_affected', v_venue_count,
    'reset_timestamp', NOW(),
    'message', 'Daily table reset completed successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. VENUE-SPECIFIC TABLE RESET FUNCTION
-- =====================================================
-- Resets tables for a specific venue only

CREATE OR REPLACE FUNCTION public.reset_venue_tables(p_venue_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_reset_count INTEGER := 0;
  v_result JSON;
  v_venue_name TEXT;
BEGIN
  -- Get venue name for logging
  SELECT name INTO v_venue_name
  FROM venues 
  WHERE venue_id = p_venue_id;
  
  IF v_venue_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  
  -- Log the reset operation
  RAISE NOTICE '[VENUE RESET] Resetting tables for venue: % (%)', v_venue_name, p_venue_id;
  
  -- Close all active table sessions for this venue
  UPDATE table_sessions 
  SET closed_at = NOW(), updated_at = NOW()
  WHERE venue_id = p_venue_id AND closed_at IS NULL;
  
  -- Get count of sessions that were closed
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Create new FREE sessions for all active tables in this venue
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
  SELECT 
    t.venue_id,
    t.id,
    'FREE',
    NOW()
  FROM tables t
  WHERE t.venue_id = p_venue_id AND t.is_active = true;
  
  -- Log the results
  RAISE NOTICE '[VENUE RESET] Reset % table sessions for venue: %', v_reset_count, v_venue_name;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'venue_id', p_venue_id,
    'venue_name', v_venue_name,
    'reset_sessions', v_reset_count,
    'reset_timestamp', NOW(),
    'message', 'Venue table reset completed successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TABLE RESET LOG TABLE
-- =====================================================
-- Track when table resets occur for monitoring and debugging

CREATE TABLE IF NOT EXISTS table_reset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT,
  reset_type TEXT NOT NULL CHECK (reset_type IN ('DAILY', 'MANUAL', 'VENUE')),
  sessions_reset INTEGER NOT NULL DEFAULT 0,
  venues_affected INTEGER DEFAULT NULL,
  reset_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  triggered_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_table_reset_logs_timestamp ON table_reset_logs(reset_timestamp);
CREATE INDEX IF NOT EXISTS idx_table_reset_logs_venue_id ON table_reset_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_reset_logs_type ON table_reset_logs(reset_type);

-- =====================================================
-- 4. ENHANCED DAILY RESET WITH LOGGING
-- =====================================================
-- Updated daily reset function that logs the operation

CREATE OR REPLACE FUNCTION public.daily_table_reset_with_log()
RETURNS JSON AS $$
DECLARE
  v_reset_count INTEGER := 0;
  v_venue_count INTEGER := 0;
  v_result JSON;
  v_log_id UUID;
BEGIN
  -- Log the reset operation
  RAISE NOTICE '[DAILY RESET] Starting daily table reset at %', NOW();
  
  -- Get count of venues for logging
  SELECT COUNT(DISTINCT venue_id) INTO v_venue_count
  FROM tables 
  WHERE is_active = true;
  
  -- Close all active table sessions (both FREE and OCCUPIED)
  UPDATE table_sessions 
  SET closed_at = NOW(), updated_at = NOW()
  WHERE closed_at IS NULL;
  
  -- Get count of sessions that were closed
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Create new FREE sessions for all active tables
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
  SELECT 
    t.venue_id,
    t.id,
    'FREE',
    NOW()
  FROM tables t
  WHERE t.is_active = true;
  
  -- Log the reset operation
  INSERT INTO table_reset_logs (venue_id, reset_type, sessions_reset, venues_affected, notes)
  VALUES (NULL, 'DAILY', v_reset_count, v_venue_count, 'Automatic daily reset')
  RETURNING id INTO v_log_id;
  
  -- Log the results
  RAISE NOTICE '[DAILY RESET] Reset % table sessions across % venues (log_id: %)', v_reset_count, v_venue_count, v_log_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'log_id', v_log_id,
    'reset_sessions', v_reset_count,
    'venues_affected', v_venue_count,
    'reset_timestamp', NOW(),
    'message', 'Daily table reset completed successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. MANUAL RESET FUNCTION (for testing/admin use)
-- =====================================================
-- Allows manual triggering of table reset

CREATE OR REPLACE FUNCTION public.manual_table_reset(p_venue_id TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_reset_count INTEGER := 0;
  v_venue_count INTEGER := 0;
  v_result JSON;
  v_log_id UUID;
  v_reset_type TEXT;
BEGIN
  -- Determine reset type
  IF p_venue_id IS NULL THEN
    v_reset_type := 'MANUAL';
  ELSE
    v_reset_type := 'VENUE';
  END IF;
  
  -- Log the reset operation
  RAISE NOTICE '[MANUAL RESET] Starting manual table reset at % (type: %, venue: %)', NOW(), v_reset_type, COALESCE(p_venue_id, 'ALL');
  
  IF p_venue_id IS NULL THEN
    -- Reset all venues
    SELECT COUNT(DISTINCT venue_id) INTO v_venue_count
    FROM tables 
    WHERE is_active = true;
    
    -- Close all active table sessions
    UPDATE table_sessions 
    SET closed_at = NOW(), updated_at = NOW()
    WHERE closed_at IS NULL;
    
    -- Get count of sessions that were closed
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;
    
    -- Create new FREE sessions for all active tables
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    SELECT 
      t.venue_id,
      t.id,
      'FREE',
      NOW()
    FROM tables t
    WHERE t.is_active = true;
    
  ELSE
    -- Reset specific venue
    v_venue_count := 1;
    
    -- Close all active table sessions for this venue
    UPDATE table_sessions 
    SET closed_at = NOW(), updated_at = NOW()
    WHERE venue_id = p_venue_id AND closed_at IS NULL;
    
    -- Get count of sessions that were closed
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;
    
    -- Create new FREE sessions for all active tables in this venue
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    SELECT 
      t.venue_id,
      t.id,
      'FREE',
      NOW()
    FROM tables t
    WHERE t.venue_id = p_venue_id AND t.is_active = true;
  END IF;
  
  -- Log the reset operation
  INSERT INTO table_reset_logs (venue_id, reset_type, sessions_reset, venues_affected, triggered_by, notes)
  VALUES (p_venue_id, v_reset_type, v_reset_count, v_venue_count, auth.uid(), 'Manual reset triggered')
  RETURNING id INTO v_log_id;
  
  -- Log the results
  RAISE NOTICE '[MANUAL RESET] Reset % table sessions across % venues (log_id: %)', v_reset_count, v_venue_count, v_log_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'log_id', v_log_id,
    'reset_type', v_reset_type,
    'venue_id', p_venue_id,
    'reset_sessions', v_reset_count,
    'venues_affected', v_venue_count,
    'reset_timestamp', NOW(),
    'message', 'Manual table reset completed successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.daily_table_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_table_reset_with_log() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_venue_tables(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manual_table_reset(TEXT) TO authenticated;

-- Grant select permissions on the log table
GRANT SELECT ON table_reset_logs TO authenticated;

-- =====================================================
-- 7. CREATE SCHEDULED JOB (if using pg_cron extension)
-- =====================================================
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- Uncomment the following lines if pg_cron is available:

-- SELECT cron.schedule(
--   'daily-table-reset',
--   '0 0 * * *', -- Run at midnight every day
--   'SELECT public.daily_table_reset_with_log();'
-- );

-- =====================================================
-- 8. USAGE EXAMPLES
-- =====================================================

-- Manual reset all tables:
-- SELECT public.manual_table_reset();

-- Manual reset specific venue:
-- SELECT public.manual_table_reset('venue-12345');

-- Daily reset (for cron job):
-- SELECT public.daily_table_reset_with_log();

-- Check reset logs:
-- SELECT * FROM table_reset_logs ORDER BY reset_timestamp DESC LIMIT 10;
