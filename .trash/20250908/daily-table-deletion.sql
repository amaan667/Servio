-- =====================================================
-- DAILY TABLE DELETION SYSTEM
-- =====================================================
-- This script creates functions to automatically DELETE all tables
-- at the start of each new day, making the count go to 0

-- =====================================================
-- 1. DAILY TABLE DELETION FUNCTION
-- =====================================================
-- Completely removes all tables and their sessions at the start of each day
-- This effectively deletes all tables, making the count go to 0

CREATE OR REPLACE FUNCTION public.daily_table_deletion()
RETURNS JSON AS $$
DECLARE
  v_deleted_tables INTEGER := 0;
  v_deleted_sessions INTEGER := 0;
  v_venue_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- Log the deletion operation
  RAISE NOTICE '[DAILY DELETION] Starting daily table deletion at %', NOW();
  
  -- Get count of venues for logging
  SELECT COUNT(DISTINCT venue_id) INTO v_venue_count
  FROM tables 
  WHERE is_active = true;
  
  -- Get count of tables to be deleted
  SELECT COUNT(*) INTO v_deleted_tables
  FROM tables 
  WHERE is_active = true;
  
  -- Get count of sessions to be deleted
  SELECT COUNT(*) INTO v_deleted_sessions
  FROM table_sessions ts
  INNER JOIN tables t ON t.id = ts.table_id
  WHERE t.is_active = true;
  
  -- Delete all table sessions first (due to foreign key constraints)
  DELETE FROM table_sessions 
  WHERE table_id IN (
    SELECT id FROM tables WHERE is_active = true
  );
  
  -- Delete all tables completely
  DELETE FROM tables 
  WHERE is_active = true;
  
  -- Log the results
  RAISE NOTICE '[DAILY DELETION] Deleted % tables and % sessions across % venues', v_deleted_tables, v_deleted_sessions, v_venue_count;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'deleted_tables', v_deleted_tables,
    'deleted_sessions', v_deleted_sessions,
    'venues_affected', v_venue_count,
    'reset_timestamp', NOW(),
    'message', 'Daily table deletion completed successfully - all tables removed'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. VENUE-SPECIFIC TABLE DELETION FUNCTION
-- =====================================================
-- Deletes all tables for a specific venue only

CREATE OR REPLACE FUNCTION public.delete_venue_tables(p_venue_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_deleted_tables INTEGER := 0;
  v_deleted_sessions INTEGER := 0;
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
  
  -- Log the deletion operation
  RAISE NOTICE '[VENUE DELETION] Deleting tables for venue: % (%)', v_venue_name, p_venue_id;
  
  -- Get count of tables to be deleted
  SELECT COUNT(*) INTO v_deleted_tables
  FROM tables 
  WHERE venue_id = p_venue_id AND is_active = true;
  
  -- Get count of sessions to be deleted
  SELECT COUNT(*) INTO v_deleted_sessions
  FROM table_sessions ts
  INNER JOIN tables t ON t.id = ts.table_id
  WHERE t.venue_id = p_venue_id AND t.is_active = true;
  
  -- Delete all table sessions for this venue first
  DELETE FROM table_sessions 
  WHERE table_id IN (
    SELECT id FROM tables WHERE venue_id = p_venue_id AND is_active = true
  );
  
  -- Delete all tables for this venue
  DELETE FROM tables 
  WHERE venue_id = p_venue_id AND is_active = true;
  
  -- Log the results
  RAISE NOTICE '[VENUE DELETION] Deleted % tables and % sessions for venue: %', v_deleted_tables, v_deleted_sessions, v_venue_name;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'venue_id', p_venue_id,
    'venue_name', v_venue_name,
    'deleted_tables', v_deleted_tables,
    'deleted_sessions', v_deleted_sessions,
    'reset_timestamp', NOW(),
    'message', 'Venue table deletion completed successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TABLE DELETION LOG TABLE
-- =====================================================
-- Track when table deletions occur for monitoring and debugging

CREATE TABLE IF NOT EXISTS table_deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN ('DAILY', 'MANUAL', 'VENUE')),
  tables_deleted INTEGER NOT NULL DEFAULT 0,
  sessions_deleted INTEGER NOT NULL DEFAULT 0,
  venues_affected INTEGER DEFAULT NULL,
  deletion_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  triggered_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_table_deletion_logs_timestamp ON table_deletion_logs(deletion_timestamp);
CREATE INDEX IF NOT EXISTS idx_table_deletion_logs_venue_id ON table_deletion_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_deletion_logs_type ON table_deletion_logs(deletion_type);

-- =====================================================
-- 4. ENHANCED DAILY DELETION WITH LOGGING
-- =====================================================
-- Updated daily deletion function that logs the operation

CREATE OR REPLACE FUNCTION public.daily_table_deletion_with_log()
RETURNS JSON AS $$
DECLARE
  v_deleted_tables INTEGER := 0;
  v_deleted_sessions INTEGER := 0;
  v_venue_count INTEGER := 0;
  v_result JSON;
  v_log_id UUID;
BEGIN
  -- Log the deletion operation
  RAISE NOTICE '[DAILY DELETION] Starting daily table deletion at %', NOW();
  
  -- Get count of venues for logging
  SELECT COUNT(DISTINCT venue_id) INTO v_venue_count
  FROM tables 
  WHERE is_active = true;
  
  -- Get count of tables to be deleted
  SELECT COUNT(*) INTO v_deleted_tables
  FROM tables 
  WHERE is_active = true;
  
  -- Get count of sessions to be deleted
  SELECT COUNT(*) INTO v_deleted_sessions
  FROM table_sessions ts
  INNER JOIN tables t ON t.id = ts.table_id
  WHERE t.is_active = true;
  
  -- Delete all table sessions first (due to foreign key constraints)
  DELETE FROM table_sessions 
  WHERE table_id IN (
    SELECT id FROM tables WHERE is_active = true
  );
  
  -- Delete all tables completely
  DELETE FROM tables 
  WHERE is_active = true;
  
  -- Log the deletion operation
  INSERT INTO table_deletion_logs (venue_id, deletion_type, tables_deleted, sessions_deleted, venues_affected, notes)
  VALUES (NULL, 'DAILY', v_deleted_tables, v_deleted_sessions, v_venue_count, 'Automatic daily deletion')
  RETURNING id INTO v_log_id;
  
  -- Log the results
  RAISE NOTICE '[DAILY DELETION] Deleted % tables and % sessions across % venues (log_id: %)', v_deleted_tables, v_deleted_sessions, v_venue_count, v_log_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'log_id', v_log_id,
    'deleted_tables', v_deleted_tables,
    'deleted_sessions', v_deleted_sessions,
    'venues_affected', v_venue_count,
    'reset_timestamp', NOW(),
    'message', 'Daily table deletion completed successfully - all tables removed'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. MANUAL DELETION FUNCTION (for testing/admin use)
-- =====================================================
-- Allows manual triggering of table deletion

CREATE OR REPLACE FUNCTION public.manual_table_deletion(p_venue_id TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_deleted_tables INTEGER := 0;
  v_deleted_sessions INTEGER := 0;
  v_venue_count INTEGER := 0;
  v_result JSON;
  v_log_id UUID;
  v_deletion_type TEXT;
BEGIN
  -- Determine deletion type
  IF p_venue_id IS NULL THEN
    v_deletion_type := 'MANUAL';
  ELSE
    v_deletion_type := 'VENUE';
  END IF;
  
  -- Log the deletion operation
  RAISE NOTICE '[MANUAL DELETION] Starting manual table deletion at % (type: %, venue: %)', NOW(), v_deletion_type, COALESCE(p_venue_id, 'ALL');
  
  IF p_venue_id IS NULL THEN
    -- Delete all venues
    SELECT COUNT(DISTINCT venue_id) INTO v_venue_count
    FROM tables 
    WHERE is_active = true;
    
    -- Get count of tables to be deleted
    SELECT COUNT(*) INTO v_deleted_tables
    FROM tables 
    WHERE is_active = true;
    
    -- Get count of sessions to be deleted
    SELECT COUNT(*) INTO v_deleted_sessions
    FROM table_sessions ts
    INNER JOIN tables t ON t.id = ts.table_id
    WHERE t.is_active = true;
    
    -- Delete all table sessions first
    DELETE FROM table_sessions 
    WHERE table_id IN (
      SELECT id FROM tables WHERE is_active = true
    );
    
    -- Delete all tables
    DELETE FROM tables 
    WHERE is_active = true;
    
  ELSE
    -- Delete specific venue
    v_venue_count := 1;
    
    -- Get count of tables to be deleted
    SELECT COUNT(*) INTO v_deleted_tables
    FROM tables 
    WHERE venue_id = p_venue_id AND is_active = true;
    
    -- Get count of sessions to be deleted
    SELECT COUNT(*) INTO v_deleted_sessions
    FROM table_sessions ts
    INNER JOIN tables t ON t.id = ts.table_id
    WHERE t.venue_id = p_venue_id AND t.is_active = true;
    
    -- Delete all table sessions for this venue first
    DELETE FROM table_sessions 
    WHERE table_id IN (
      SELECT id FROM tables WHERE venue_id = p_venue_id AND is_active = true
    );
    
    -- Delete all tables for this venue
    DELETE FROM tables 
    WHERE venue_id = p_venue_id AND is_active = true;
  END IF;
  
  -- Log the deletion operation
  INSERT INTO table_deletion_logs (venue_id, deletion_type, tables_deleted, sessions_deleted, venues_affected, triggered_by, notes)
  VALUES (p_venue_id, v_deletion_type, v_deleted_tables, v_deleted_sessions, v_venue_count, auth.uid(), 'Manual deletion triggered')
  RETURNING id INTO v_log_id;
  
  -- Log the results
  RAISE NOTICE '[MANUAL DELETION] Deleted % tables and % sessions across % venues (log_id: %)', v_deleted_tables, v_deleted_sessions, v_venue_count, v_log_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'log_id', v_log_id,
    'deletion_type', v_deletion_type,
    'venue_id', p_venue_id,
    'deleted_tables', v_deleted_tables,
    'deleted_sessions', v_deleted_sessions,
    'venues_affected', v_venue_count,
    'reset_timestamp', NOW(),
    'message', 'Manual table deletion completed successfully - all tables removed'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.daily_table_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_table_deletion_with_log() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_venue_tables(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manual_table_deletion(TEXT) TO authenticated;

-- Grant select permissions on the log table
GRANT SELECT ON table_deletion_logs TO authenticated;

-- =====================================================
-- 7. CREATE SCHEDULED JOB (if using pg_cron extension)
-- =====================================================
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- Uncomment the following lines if pg_cron is available:

-- SELECT cron.unschedule('daily-table-deletion');
-- SELECT cron.schedule(
--   'daily-table-deletion',
--   '0 0 * * *', -- Run at midnight every day
--   'SELECT public.daily_table_deletion_with_log();'
-- );

-- =====================================================
-- 8. USAGE EXAMPLES
-- =====================================================

-- Manual deletion all tables:
-- SELECT public.manual_table_deletion();

-- Manual deletion specific venue:
-- SELECT public.manual_table_deletion('venue-12345');

-- Daily deletion (for cron job):
-- SELECT public.daily_table_deletion_with_log();

-- Check deletion logs:
-- SELECT * FROM table_deletion_logs ORDER BY deletion_timestamp DESC LIMIT 10;
