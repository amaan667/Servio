-- Script to ensure all active tables have FREE sessions
-- Run this in your Supabase SQL editor

-- First, check if the function exists
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_name = 'ensure_free_sessions_for_active_tables';

-- Drop the existing function first (in case it has a different signature)
DROP FUNCTION IF EXISTS ensure_free_sessions_for_active_tables();

-- Create the function with the correct signature
CREATE OR REPLACE FUNCTION ensure_free_sessions_for_active_tables()
RETURNS INTEGER AS $$
DECLARE
  tables_updated INTEGER := 0;
  table_record RECORD;
BEGIN
  -- Find all active tables without a FREE session
  FOR table_record IN 
    SELECT t.id, t.venue_id, t.label
    FROM tables t
    WHERE t.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM table_sessions s 
        WHERE s.table_id = t.id 
          AND s.closed_at IS NULL 
          AND s.status = 'FREE'
      )
  LOOP
    -- Create a FREE session for this table
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    VALUES (table_record.venue_id, table_record.id, 'FREE', NOW());
    
    tables_updated := tables_updated + 1;
    
    RAISE NOTICE 'Created FREE session for table: % (ID: %)', table_record.label, table_record.id;
  END LOOP;
  
  RETURN tables_updated;
END;
$$ LANGUAGE plpgsql;

-- Run the function
SELECT ensure_free_sessions_for_active_tables() as tables_updated;

-- Verify the results
SELECT 
  t.label,
  t.seat_count,
  s.status as session_status,
  s.opened_at
FROM tables t
LEFT JOIN table_sessions s ON s.table_id = t.id AND s.closed_at IS NULL
WHERE t.is_active = true
ORDER BY t.label;
