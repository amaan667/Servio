-- Fix the merge function to be more flexible with table statuses
-- This version allows merging tables that are FREE or don't have active sessions

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
  -- Get table information for both tables
  SELECT *
  INTO v_table_a_info
  FROM tables 
  WHERE id = p_table_a AND venue_id = p_venue_id;
  
  SELECT *
  INTO v_table_b_info
  FROM tables 
  WHERE id = p_table_b AND venue_id = p_venue_id;
  
  -- Validate both tables exist
  IF v_table_a_info IS NULL OR v_table_b_info IS NULL THEN
    RAISE EXCEPTION 'One or both tables not found';
  END IF;
  
  -- Check if tables are already merged
  IF v_table_a_info.merged_with_table_id IS NOT NULL OR v_table_b_info.merged_with_table_id IS NOT NULL THEN
    RAISE EXCEPTION 'One or both tables are already merged';
  END IF;
  
  -- Get current sessions for both tables (if they exist)
  SELECT *
  INTO v_session_a
  FROM table_sessions 
  WHERE table_id = p_table_a AND closed_at IS NULL;
  
  SELECT *
  INTO v_session_b
  FROM table_sessions 
  WHERE table_id = p_table_b AND closed_at IS NULL;
  
  -- More flexible validation: allow merging if:
  -- 1. Both tables are FREE, OR
  -- 2. One or both tables don't have active sessions, OR  
  -- 3. Both tables are in a mergeable state (FREE, RESERVED, or no session)
  IF (v_session_a IS NOT NULL AND v_session_a.status NOT IN ('FREE', 'RESERVED')) OR 
     (v_session_b IS NOT NULL AND v_session_b.status NOT IN ('FREE', 'RESERVED')) THEN
    RAISE EXCEPTION 'Tables must be FREE or RESERVED to merge (current statuses: % and %)', 
      COALESCE(v_session_a.status, 'NO_SESSION'), 
      COALESCE(v_session_b.status, 'NO_SESSION');
  END IF;
  
  -- Create merged label (combine the labels)
  v_merged_label := v_table_a_info.label || '+' || v_table_b_info.label;
  
  -- Calculate merged seat count
  v_merged_seat_count := v_table_a_info.seat_count + v_table_b_info.seat_count;
  
  -- Close session for table B (secondary table) if it exists
  IF v_session_b IS NOT NULL THEN
    UPDATE table_sessions 
    SET 
      closed_at = NOW(),
      updated_at = NOW()
    WHERE table_id = p_table_b AND closed_at IS NULL;
  END IF;
  
  -- Update table A (primary table) with merged information
  UPDATE tables 
  SET 
    label = v_merged_label,
    seat_count = v_merged_seat_count,
    updated_at = NOW()
  WHERE id = p_table_a;
  
  -- Mark table B as merged with table A
  UPDATE tables 
  SET 
    merged_with_table_id = p_table_a,
    updated_at = NOW()
  WHERE id = p_table_b;
  
  -- Create or update session for table A to be FREE
  IF v_session_a IS NOT NULL THEN
    -- Update existing session to FREE
    UPDATE table_sessions 
    SET 
      status = 'FREE',
      updated_at = NOW()
    WHERE table_id = p_table_a AND closed_at IS NULL;
  ELSE
    -- Create new FREE session for table A
    INSERT INTO table_sessions (table_id, venue_id, status, opened_at, created_at, updated_at)
    VALUES (p_table_a, p_venue_id, 'FREE', NOW(), NOW(), NOW());
  END IF;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Tables merged successfully',
    'merged_table_id', p_table_a,
    'merged_label', v_merged_label,
    'merged_seat_count', v_merged_seat_count,
    'secondary_table_id', p_table_b
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$;
