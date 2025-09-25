-- Fix unmerge function to properly handle + format labels
-- This function will work with the current merge format that creates labels like "9+99"

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS api_unmerge_table(TEXT);
DROP FUNCTION IF EXISTS api_unmerge_table(UUID);

-- Create the corrected unmerge function
CREATE OR REPLACE FUNCTION api_unmerge_table(
  p_secondary_table_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merged_table_info RECORD;
  v_secondary_table_info RECORD;
  v_original_label_a TEXT;
  v_original_label_b TEXT;
  v_original_seat_count_a INTEGER;
  v_original_seat_count_b INTEGER;
  v_result JSON;
  v_merged_table_uuid UUID;
  v_secondary_table_uuid UUID;
BEGIN
  -- Convert TEXT parameter to UUID
  BEGIN
    v_secondary_table_uuid := p_secondary_table_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID format for table ID: %', p_secondary_table_id;
  END;
  
  -- Get the secondary table information (the one passed as parameter)
  SELECT *
  INTO v_secondary_table_info
  FROM tables 
  WHERE id = v_secondary_table_uuid;
  
  -- Validate the secondary table exists
  IF v_secondary_table_info IS NULL THEN
    RAISE EXCEPTION 'Secondary table not found';
  END IF;
  
  -- Find the primary table (merged table) that this secondary table is merged with
  SELECT *
  INTO v_merged_table_info
  FROM tables 
  WHERE id = v_secondary_table_info.merged_with_table_id;
  
  -- Validate primary table exists
  IF v_merged_table_info IS NULL THEN
    RAISE EXCEPTION 'No primary table found for this merge';
  END IF;
  
  v_merged_table_uuid := v_merged_table_info.id;
  
  -- Parse the merged label to extract original table labels
  -- Handle both + format and "merged with" format
  IF v_merged_table_info.label LIKE '%+%' THEN
    -- Handle + format: "Table1+Table2" (current format)
    v_original_label_a := TRIM(SPLIT_PART(v_merged_table_info.label, '+', 1));
    v_original_label_b := TRIM(SPLIT_PART(v_merged_table_info.label, '+', 2));
  ELSIF v_merged_table_info.label LIKE '% merged with %' THEN
    -- Handle "merged with" format: "Table1 merged with Table2" (legacy format)
    v_original_label_a := TRIM(SPLIT_PART(v_merged_table_info.label, ' merged with ', 1));
    v_original_label_b := TRIM(SPLIT_PART(v_merged_table_info.label, ' merged with ', 2));
  ELSE
    -- Fallback: try to extract from the label using other patterns
    v_original_label_a := 'Table';
    v_original_label_b := 'Table';
  END IF;
  
  -- Ensure we have valid labels
  IF v_original_label_a IS NULL OR v_original_label_a = '' THEN
    v_original_label_a := 'Table';
  END IF;
  IF v_original_label_b IS NULL OR v_original_label_b = '' THEN
    v_original_label_b := 'Table';
  END IF;
  
  -- Calculate original seat counts (assume equal distribution)
  v_original_seat_count_a := 2;
  v_original_seat_count_b := 2;
  
  -- If we have the total seat count, try to distribute it
  IF v_merged_table_info.seat_count > 0 THEN
    v_original_seat_count_a := v_merged_table_info.seat_count / 2;
    v_original_seat_count_b := v_merged_table_info.seat_count - v_original_seat_count_a;
  END IF;
  
  -- Start the unmerge process
  
  -- 1. Restore the primary table (merged table) to its original state
  UPDATE tables 
  SET 
    label = v_original_label_a,
    seat_count = v_original_seat_count_a,
    updated_at = NOW()
  WHERE id = v_merged_table_uuid;
  
  -- 2. Restore the secondary table to its original state
  UPDATE tables 
  SET 
    label = v_original_label_b,
    seat_count = v_original_seat_count_b,
    merged_with_table_id = NULL,
    updated_at = NOW()
  WHERE id = v_secondary_table_uuid;
  
  -- 3. Close any existing session for the merged table
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id = v_merged_table_uuid AND closed_at IS NULL;
  
  -- 4. Create new FREE sessions for both tables
  INSERT INTO table_sessions (table_id, venue_id, status, opened_at, created_at, updated_at)
  VALUES 
    (v_merged_table_uuid, v_merged_table_info.venue_id, 'FREE', NOW(), NOW(), NOW()),
    (v_secondary_table_uuid, v_secondary_table_info.venue_id, 'FREE', NOW(), NOW(), NOW())
  ON CONFLICT (table_id) WHERE closed_at IS NULL DO UPDATE SET
    status = 'FREE',
    updated_at = NOW();
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Tables unmerged successfully',
    'restored_tables', json_build_array(
      json_build_object(
        'id', v_merged_table_uuid,
        'label', v_original_label_a,
        'seat_count', v_original_seat_count_a
      ),
      json_build_object(
        'id', v_secondary_table_uuid,
        'label', v_original_label_b,
        'seat_count', v_original_seat_count_b
      )
    )
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION api_unmerge_table(TEXT) TO authenticated;
