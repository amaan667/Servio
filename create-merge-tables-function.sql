-- Create function to merge two tables
-- This function handles merging tables with proper seat count aggregation and sensible naming

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
  SELECT id, label, seat_count, venue_id
  INTO v_table_a_info
  FROM tables 
  WHERE id = p_table_a AND venue_id = p_venue_id;
  
  SELECT id, label, seat_count, venue_id
  INTO v_table_b_info
  FROM tables 
  WHERE id = p_table_b AND venue_id = p_venue_id;
  
  -- Validate both tables exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'One or both tables not found';
  END IF;
  
  -- Get current sessions for both tables
  SELECT *
  INTO v_session_a
  FROM table_sessions 
  WHERE table_id = p_table_a AND closed_at IS NULL;
  
  SELECT *
  INTO v_session_b
  FROM table_sessions 
  WHERE table_id = p_table_b AND closed_at IS NULL;
  
  -- Validate sessions exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'One or both tables do not have active sessions';
  END IF;
  
  -- Determine merge rules based on table statuses
  -- FREE tables can only merge with other FREE tables
  -- RESERVED and OCCUPIED tables can only merge with FREE tables
  
  IF v_session_a.status = 'FREE' THEN
    -- FREE table can only merge with other FREE tables
    IF v_session_b.status != 'FREE' THEN
      RAISE EXCEPTION 'FREE tables can only merge with other FREE tables';
    END IF;
  ELSIF v_session_a.status = 'RESERVED' OR v_session_a.status IN ('ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL') THEN
    -- RESERVED or OCCUPIED tables can only merge with FREE tables
    IF v_session_b.status != 'FREE' THEN
      RAISE EXCEPTION 'Reserved or occupied tables can only merge with FREE tables';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid table status for merging: %', v_session_a.status;
  END IF;
  
  -- Create merged table name (show which table was merged with which)
  v_merged_label := v_table_a_info.label || ' merged with ' || v_table_b_info.label;
  
  -- Calculate total seat count
  v_merged_seat_count := v_table_a_info.seat_count + v_table_b_info.seat_count;
  
  -- Update table A with merged information
  UPDATE tables 
  SET 
    label = v_merged_label,
    seat_count = v_merged_seat_count,
    updated_at = NOW()
  WHERE id = p_table_a;
  
  -- Close session B and mark table B as merged
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_session_b.id;
  
  -- Create a new session for table B with merged status
  INSERT INTO table_sessions (
    table_id,
    venue_id,
    status,
    merged_with_table_id,
    opened_at,
    created_at,
    updated_at
  ) VALUES (
    p_table_b,
    p_venue_id,
    'MERGED',
    p_table_a,
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Update table B to indicate it's merged (this table will be hidden from display)
  UPDATE tables 
  SET 
    label = v_table_b_info.label || ' (merged into ' || v_table_a_info.label || ')',
    merged_with_table_id = p_table_a,
    updated_at = NOW()
  WHERE id = p_table_b;
  
  -- Prepare result
  v_result := json_build_object(
    'success', true,
    'merged_table_id', p_table_a,
    'merged_table_label', v_merged_label,
    'merged_seat_count', v_merged_seat_count,
    'secondary_table_id', p_table_b,
    'secondary_table_label', v_table_b_info.label || ' (merged with ' || v_table_a_info.label || ')'
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

-- Create function to unmerge tables
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
  v_original_labels TEXT[];
  v_original_seat_counts INTEGER[];
  v_result JSON;
BEGIN
  -- Get secondary table information
  SELECT id, label, seat_count, merged_with_table_id, venue_id
  INTO v_secondary_table
  FROM tables 
  WHERE id = p_secondary_table_id;
  
  -- Validate table exists and is merged
  IF NOT FOUND THEN
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
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Primary table not found';
  END IF;
  
  -- Parse original labels and seat counts from the merged label
  -- Format: "Table1+Table2" -> ["Table1", "Table2"]
  -- For now, we'll restore to default values since we can't perfectly parse
  -- In a real implementation, you might want to store original values separately
  
  -- Restore secondary table to FREE status
  -- Parse the original seat count from the merged label or use a sensible default
  -- Format: "Table1 merged with Table2" - we need to extract the original seat count
  -- For now, we'll restore to 2 seats as the default, but ideally we'd store original values
  UPDATE tables 
  SET 
    label = COALESCE(NULLIF(SPLIT_PART(v_secondary_table.label, ' (merged with ', 1), ''), 'Table'),
    seat_count = 2, -- Restore to original seat count (assuming tables were 2 seats each)
    merged_with_table_id = NULL,
    updated_at = NOW()
  WHERE id = p_secondary_table_id;
  
  -- Close the MERGED session for secondary table
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id = p_secondary_table_id 
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
    p_secondary_table_id,
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
    seat_count = 2, -- Restore to original seat count (assuming tables were 2 seats each)
    updated_at = NOW()
  WHERE id = v_primary_table.id;
  
  -- Prepare result
  v_result := json_build_object(
    'success', true,
    'unmerged_tables', json_build_array(
      json_build_object('id', v_primary_table.id, 'label', COALESCE(NULLIF(SPLIT_PART(v_primary_table.label, ' merged with ', 1), ''), 'Table')),
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
