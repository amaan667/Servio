-- Fixed unmerge function without nested DECLARE blocks
-- This function will properly unmerge tables and restore them to their original state

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS api_unmerge_table(TEXT);
DROP FUNCTION IF EXISTS api_unmerge_table(UUID);

-- Create a corrected unmerge function
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
  v_original_label_a TEXT;
  v_original_label_b TEXT;
  v_secondary_table_uuid UUID;
BEGIN
  -- Convert TEXT parameter to UUID with proper error handling
  BEGIN
    v_secondary_table_uuid := p_secondary_table_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID format for table ID: %', p_secondary_table_id;
  END;
  
  -- Get secondary table information
  SELECT id, label, seat_count, merged_with_table_id, venue_id
  INTO v_secondary_table
  FROM tables 
  WHERE id = v_secondary_table_uuid;
  
  -- Validate table exists and is merged
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Secondary table not found';
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
  
  -- Parse the merged label to extract original table names
  -- Handle both + format and "merged with" format
  IF v_primary_table.label LIKE '%+%' THEN
    -- Handle + format: "Table1+Table2" (current format)
    v_original_label_a := TRIM(SPLIT_PART(v_primary_table.label, '+', 1));
    v_original_label_b := TRIM(SPLIT_PART(v_primary_table.label, '+', 2));
  ELSIF v_primary_table.label LIKE '% merged with %' THEN
    -- Handle "merged with" format: "Table1 merged with Table2" (legacy format)
    v_original_label_a := TRIM(SPLIT_PART(v_primary_table.label, ' merged with ', 1));
    v_original_label_b := TRIM(SPLIT_PART(v_primary_table.label, ' merged with ', 2));
  ELSE
    -- Fallback: use simple defaults
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
  
  -- Start the unmerge process
  
  -- 1. Restore the primary table to its original state
  UPDATE tables 
  SET 
    label = v_original_label_a,
    seat_count = 2, -- Default seat count
    updated_at = NOW()
  WHERE id = v_primary_table.id;
  
  -- 2. Restore the secondary table to its original state
  UPDATE tables 
  SET 
    label = v_original_label_b,
    seat_count = 2, -- Default seat count
    merged_with_table_id = NULL,
    updated_at = NOW()
  WHERE id = v_secondary_table.id;
  
  -- 3. Close any existing sessions for both tables
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id IN (v_primary_table.id, v_secondary_table.id) 
    AND closed_at IS NULL;
  
  -- 4. Create new FREE sessions for both tables
  INSERT INTO table_sessions (table_id, venue_id, status, opened_at, created_at, updated_at)
  VALUES 
    (v_primary_table.id, v_primary_table.venue_id, 'FREE', NOW(), NOW(), NOW()),
    (v_secondary_table.id, v_secondary_table.venue_id, 'FREE', NOW(), NOW(), NOW())
  ON CONFLICT (table_id) WHERE closed_at IS NULL DO UPDATE SET
    status = 'FREE',
    updated_at = NOW();
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Tables unmerged successfully',
    'restored_tables', json_build_array(
      json_build_object(
        'id', v_primary_table.id,
        'label', v_original_label_a,
        'seat_count', 2
      ),
      json_build_object(
        'id', v_secondary_table.id,
        'label', v_original_label_b,
        'seat_count', 2
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
