-- Fix Unmerge Function to handle + format labels correctly
-- This script updates the unmerge function to properly parse labels with + format

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS api_unmerge_table(UUID);

-- Create corrected function to unmerge tables with + format labels
CREATE OR REPLACE FUNCTION api_unmerge_table(
  p_secondary_table_id UUID
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
  
  -- Parse the merged label to extract original table names
  -- Handle both + format and "merged with" format
  IF v_primary_table.label LIKE '%+%' THEN
    -- Handle + format: "Table1+Table2"
    v_original_label_a := SPLIT_PART(v_primary_table.label, '+', 1);
    v_original_label_b := SPLIT_PART(v_primary_table.label, '+', 2);
  ELSIF v_primary_table.label LIKE '% merged with %' THEN
    -- Handle "merged with" format: "Table1 merged with Table2"
    v_original_label_a := SPLIT_PART(v_primary_table.label, ' merged with ', 1);
    v_original_label_b := SPLIT_PART(v_primary_table.label, ' merged with ', 2);
  ELSIF v_primary_table.label LIKE '% (merged with %' THEN
    -- Handle "(merged with" format: "Table1 (merged with Table2)"
    v_original_label_a := SPLIT_PART(v_primary_table.label, ' (merged with ', 1);
    v_original_label_b := SPLIT_PART(v_primary_table.label, ' (merged with ', 2);
    -- Remove trailing parenthesis if present
    v_original_label_b := TRIM(TRAILING ')' FROM v_original_label_b);
  ELSE
    -- Fallback: try to extract table numbers from the label
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
  
  -- Restore secondary table to FREE status
  UPDATE tables 
  SET 
    label = v_original_label_b,
    seat_count = 2, -- Restore to default seat count
    merged_with_table_id = NULL,
    updated_at = NOW()
  WHERE id = p_secondary_table_id;
  
  -- Close the OCCUPIED session for secondary table (which was created during merge)
  UPDATE table_sessions 
  SET 
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id = p_secondary_table_id 
    AND status = 'OCCUPIED' 
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
    label = v_original_label_a,
    seat_count = 2, -- Restore to default seat count
    updated_at = NOW()
  WHERE id = v_primary_table.id;
  
  -- Prepare result
  v_result := json_build_object(
    'success', true,
    'unmerged_tables', json_build_array(
      json_build_object('id', v_primary_table.id, 'label', v_original_label_a),
      json_build_object('id', p_secondary_table_id, 'label', v_original_label_b)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION api_unmerge_table(UUID) TO authenticated;
