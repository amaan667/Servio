-- Fix UUID vs TEXT Type Mismatch in Merge Functions
-- This script specifically addresses the "operator does not exist: uuid = text" error

-- First, let's check what functions currently exist
-- SELECT proname, proargtypes::regtype[] FROM pg_proc WHERE proname IN ('api_merge_tables', 'api_unmerge_table');

-- Drop ALL existing versions of these functions (including any with UUID parameters)
DROP FUNCTION IF EXISTS api_merge_tables(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS api_merge_tables(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS api_merge_tables(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS api_unmerge_table(TEXT);
DROP FUNCTION IF EXISTS api_unmerge_table(UUID);

-- Create function to merge two tables with TEXT parameters (matching what the API sends)
CREATE OR REPLACE FUNCTION api_merge_tables(
  p_venue_id TEXT,
  p_table_a TEXT,
  p_table_b TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_a_info RECORD;
  v_table_b_info RECORD;
  v_session_a RECORD;
  v_session_b RECORD;
  v_merged_label TEXT;
  v_merged_seat_count INTEGER;
  v_result JSON;
BEGIN
  -- Get table information for both tables (convert TEXT to UUID for comparison)
  SELECT id, label, seat_count, venue_id
  INTO v_table_a_info
  FROM tables 
  WHERE id::TEXT = p_table_a AND venue_id = p_venue_id;
  
  SELECT id, label, seat_count, venue_id
  INTO v_table_b_info
  FROM tables 
  WHERE id::TEXT = p_table_b AND venue_id = p_venue_id;
  
  -- Validate both tables exist
  IF v_table_a_info.id IS NULL OR v_table_b_info.id IS NULL THEN
    RAISE EXCEPTION 'One or both tables not found';
  END IF;
  
  -- Get current sessions for both tables (use actual UUID values)
  SELECT *
  INTO v_session_a
  FROM table_sessions 
  WHERE table_id = v_table_a_info.id AND closed_at IS NULL;
  
  SELECT *
  INTO v_session_b
  FROM table_sessions 
  WHERE table_id = v_table_b_info.id AND closed_at IS NULL;
  
  -- Validate sessions exist
  IF v_session_a.id IS NULL OR v_session_b.id IS NULL THEN
    RAISE EXCEPTION 'One or both table sessions not found';
  END IF;
  
  -- Validate both tables are FREE
  IF v_session_a.status != 'FREE' OR v_session_b.status != 'FREE' THEN
    RAISE EXCEPTION 'Both tables must be FREE to merge';
  END IF;
  
  -- Create merged label (combine the labels)
  v_merged_label := v_table_a_info.label || '+' || v_table_b_info.label;
  
  -- Calculate merged seat count
  v_merged_seat_count := v_table_a_info.seat_count + v_table_b_info.seat_count;
  
  -- Close session for table B (secondary table)
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id = v_table_b_info.id AND closed_at IS NULL;
  
  -- Update table A (primary table) with merged information
  UPDATE tables 
  SET 
    label = v_merged_label,
    seat_count = v_merged_seat_count,
    updated_at = NOW()
  WHERE id = v_table_a_info.id;
  
  -- Update table B (secondary table) to mark it as merged
  UPDATE tables 
  SET 
    merged_with_table_id = v_table_a_info.id,
    updated_at = NOW()
  WHERE id = v_table_b_info.id;
  
  -- Update table A session to reflect the merge
  UPDATE table_sessions 
  SET 
    status = 'MERGED',
    updated_at = NOW()
  WHERE table_id = v_table_a_info.id AND closed_at IS NULL;
  
  -- Create a MERGED session for table B to track the merge
  INSERT INTO table_sessions (
    table_id,
    venue_id,
    status,
    opened_at,
    created_at,
    updated_at
  ) VALUES (
    v_table_b_info.id,
    p_venue_id,
    'MERGED',
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Prepare result
  v_result := json_build_object(
    'success', true,
    'merged_table_id', v_table_a_info.id::TEXT,
    'merged_label', v_merged_label,
    'merged_seat_count', v_merged_seat_count,
    'secondary_table_id', v_table_b_info.id::TEXT
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Create function to unmerge tables with TEXT parameter
CREATE OR REPLACE FUNCTION api_unmerge_table(
  p_secondary_table_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secondary_table RECORD;
  v_primary_table RECORD;
  v_result JSON;
BEGIN
  -- Get secondary table information (convert TEXT to UUID for comparison)
  SELECT id, label, seat_count, merged_with_table_id, venue_id
  INTO v_secondary_table
  FROM tables 
  WHERE id::TEXT = p_secondary_table_id;
  
  -- Validate table exists and is merged
  IF v_secondary_table.id IS NULL THEN
    RAISE EXCEPTION 'Table not found';
  END IF;
  
  IF v_secondary_table.merged_with_table_id IS NULL THEN
    RAISE EXCEPTION 'Table is not merged';
  END IF;
  
  -- Get primary table information
  SELECT id, label, seat_count, venue_id
  INTO v_primary_table
  FROM tables 
  WHERE id = v_secondary_table.merged_with_table_id;
  
  IF v_primary_table.id IS NULL THEN
    RAISE EXCEPTION 'Primary table not found';
  END IF;
  
  -- Restore secondary table to FREE status
  UPDATE tables 
  SET 
    label = COALESCE(NULLIF(SPLIT_PART(v_secondary_table.label, ' (merged with ', 1), ''), 'Table'),
    seat_count = 2,
    merged_with_table_id = NULL,
    updated_at = NOW()
  WHERE id = v_secondary_table.id;
  
  -- Close the MERGED session for secondary table
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id = v_secondary_table.id 
    AND status = 'MERGED' 
    AND closed_at IS NULL;
  
  -- Create new FREE session for secondary table
  INSERT INTO table_sessions (
    table_id,
    venue_id,
    status,
    opened_at,
    created_at,
    updated_at
  ) VALUES (
    v_secondary_table.id,
    v_secondary_table.venue_id,
    'FREE',
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Restore primary table to its original state
  UPDATE tables 
  SET 
    label = COALESCE(NULLIF(SPLIT_PART(v_primary_table.label, ' merged with ', 1), ''), 'Table'),
    seat_count = 2,
    updated_at = NOW()
  WHERE id = v_primary_table.id;
  
  -- Prepare result
  v_result := json_build_object(
    'success', true,
    'unmerged_tables', json_build_array(
      json_build_object('id', v_primary_table.id::TEXT, 'label', COALESCE(NULLIF(SPLIT_PART(v_primary_table.label, ' merged with ', 1), ''), 'Table')),
      json_build_object('id', p_secondary_table_id, 'label', COALESCE(NULLIF(SPLIT_PART(v_secondary_table.label, ' (merged with ', 1), ''), 'Table'))
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION api_merge_tables(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api_unmerge_table(TEXT) TO authenticated;

-- Verify the functions were created correctly
SELECT 
  proname as function_name,
  proargtypes::regtype[] as parameter_types,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('api_merge_tables', 'api_unmerge_table')
ORDER BY proname, proargtypes;
