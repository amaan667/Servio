-- Simple unmerge function that works in all PostgreSQL contexts
-- This function will properly unmerge tables and restore them to their original state

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS api_unmerge_table(TEXT);
DROP FUNCTION IF EXISTS api_unmerge_table(UUID);

-- Create a simple, working unmerge function
CREATE OR REPLACE FUNCTION api_unmerge_table(
  p_secondary_table_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secondary_table_id UUID;
  v_secondary_table_label TEXT;
  v_secondary_table_seat_count INTEGER;
  v_secondary_table_merged_with UUID;
  v_secondary_table_venue_id TEXT;
  
  v_primary_table_id UUID;
  v_primary_table_label TEXT;
  v_primary_table_seat_count INTEGER;
  v_primary_table_venue_id TEXT;
  
  v_original_label_a TEXT;
  v_original_label_b TEXT;
  v_result JSON;
BEGIN
  -- Convert TEXT parameter to UUID
  BEGIN
    v_secondary_table_id := p_secondary_table_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN json_build_object('success', false, 'error', 'Invalid UUID format for table ID: ' || p_secondary_table_id);
  END;
  
  -- Get secondary table information
  SELECT id, label, seat_count, merged_with_table_id, venue_id
  INTO v_secondary_table_id, v_secondary_table_label, v_secondary_table_seat_count, v_secondary_table_merged_with, v_secondary_table_venue_id
  FROM tables 
  WHERE id = v_secondary_table_id;
  
  -- Validate table exists and is merged
  IF v_secondary_table_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Secondary table not found');
  END IF;
  
  IF v_secondary_table_merged_with IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Table is not merged');
  END IF;
  
  -- Get primary table information
  SELECT id, label, seat_count, venue_id
  INTO v_primary_table_id, v_primary_table_label, v_primary_table_seat_count, v_primary_table_venue_id
  FROM tables 
  WHERE id = v_secondary_table_merged_with;
  
  IF v_primary_table_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Primary table not found');
  END IF;
  
  -- Parse the merged label to extract original table names
  -- Handle both + format and "merged with" format
  IF v_primary_table_label LIKE '%+%' THEN
    -- Handle + format: "Table1+Table2" (current format)
    v_original_label_a := TRIM(SPLIT_PART(v_primary_table_label, '+', 1));
    v_original_label_b := TRIM(SPLIT_PART(v_primary_table_label, '+', 2));
  ELSIF v_primary_table_label LIKE '% merged with %' THEN
    -- Handle "merged with" format: "Table1 merged with Table2" (legacy format)
    v_original_label_a := TRIM(SPLIT_PART(v_primary_table_label, ' merged with ', 1));
    v_original_label_b := TRIM(SPLIT_PART(v_primary_table_label, ' merged with ', 2));
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
    seat_count = 2,
    updated_at = NOW()
  WHERE id = v_primary_table_id;
  
  -- 2. Restore the secondary table to its original state
  UPDATE tables 
  SET 
    label = v_original_label_b,
    seat_count = 2,
    merged_with_table_id = NULL,
    updated_at = NOW()
  WHERE id = v_secondary_table_id;
  
  -- 3. Close any existing sessions for both tables
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id IN (v_primary_table_id, v_secondary_table_id) 
    AND closed_at IS NULL;
  
  -- 4. Create new FREE sessions for both tables
  INSERT INTO table_sessions (table_id, venue_id, status, opened_at, created_at, updated_at)
  VALUES 
    (v_primary_table_id, v_primary_table_venue_id, 'FREE', NOW(), NOW(), NOW()),
    (v_secondary_table_id, v_secondary_table_venue_id, 'FREE', NOW(), NOW(), NOW())
  ON CONFLICT (table_id) WHERE closed_at IS NULL DO UPDATE SET
    status = 'FREE',
    updated_at = NOW();
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Tables unmerged successfully',
    'restored_tables', json_build_array(
      json_build_object(
        'id', v_primary_table_id,
        'label', v_original_label_a,
        'seat_count', 2
      ),
      json_build_object(
        'id', v_secondary_table_id,
        'label', v_original_label_b,
        'seat_count', 2
      )
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION api_unmerge_table(TEXT) TO authenticated;
