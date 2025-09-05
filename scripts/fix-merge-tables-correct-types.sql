-- Fix the api_merge_tables function with correct data types
-- venue_id is TEXT, but table_id is UUID

-- Drop any existing versions
DROP FUNCTION IF EXISTS public.api_merge_tables(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.api_merge_tables(UUID, UUID, UUID);

-- Create the correct version
CREATE OR REPLACE FUNCTION api_merge_tables(
  p_venue_id TEXT,
  p_table_a UUID,
  p_table_b UUID
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_status_a TEXT;
  v_status_b TEXT;
  v_session_a UUID;
  v_session_b UUID;
  v_primary_table UUID;
  v_secondary_table UUID;
  v_primary_session UUID;
  v_table_a_label TEXT;
  v_table_b_label TEXT;
  v_primary_label TEXT;
  v_secondary_label TEXT;
BEGIN
  -- Sanity: tables in same venue and active
  IF NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = p_table_a AND t.venue_id = p_venue_id AND t.is_active) THEN
    RAISE EXCEPTION 'Table A invalid or inactive';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = p_table_b AND t.venue_id = p_venue_id AND t.is_active) THEN
    RAISE EXCEPTION 'Table B invalid or inactive';
  END IF;

  -- Get table labels
  SELECT label INTO v_table_a_label FROM tables WHERE id = p_table_a;
  SELECT label INTO v_table_b_label FROM tables WHERE id = p_table_b;

  -- Fetch open sessions (if any) and statuses
  SELECT s.id, s.status::TEXT INTO v_session_a, v_status_a
    FROM table_sessions s
    WHERE s.table_id = p_table_a AND s.closed_at IS NULL
    LIMIT 1;

  SELECT s.id, s.status::TEXT INTO v_session_b, v_status_b
    FROM table_sessions s
    WHERE s.table_id = p_table_b AND s.closed_at IS NULL
    LIMIT 1;

  -- Normalize nulls to 'FREE' (sessionless should not happen if you seed FREE sessions)
  IF v_status_a IS NULL THEN v_status_a := 'FREE'; END IF;
  IF v_status_b IS NULL THEN v_status_b := 'FREE'; END IF;

  -- Merge eligibility rules
  IF v_status_a = 'FREE' AND v_status_b = 'FREE' THEN
    -- Both FREE: merge into one FREE session (keep A as primary)
    v_primary_table := p_table_a;
    v_secondary_table := p_table_b;
    v_primary_label := v_table_a_label;
    v_secondary_label := v_table_b_label;
    v_primary_session := v_session_a;
  ELSIF v_status_a = 'FREE' AND v_status_b IN ('RESERVED', 'OCCUPIED') THEN
    -- A is FREE, B is active: merge B into A (A becomes primary)
    v_primary_table := p_table_a;
    v_secondary_table := p_table_b;
    v_primary_label := v_table_a_label;
    v_secondary_label := v_table_b_label;
    v_primary_session := v_session_a;
  ELSIF v_status_a IN ('RESERVED', 'OCCUPIED') AND v_status_b = 'FREE' THEN
    -- A is active, B is FREE: merge A into B (B becomes primary)
    v_primary_table := p_table_b;
    v_secondary_table := p_table_a;
    v_primary_label := v_table_b_label;
    v_secondary_label := v_table_a_label;
    v_primary_session := v_session_b;
  ELSE
    RAISE EXCEPTION 'Invalid merge: % table cannot merge with % table', v_status_a, v_status_b;
  END IF;

  -- Close secondary session if it exists
  IF v_secondary_table = p_table_a AND v_session_a IS NOT NULL THEN
    UPDATE table_sessions SET closed_at = NOW() WHERE id = v_session_a;
  ELSIF v_secondary_table = p_table_b AND v_session_b IS NOT NULL THEN
    UPDATE table_sessions SET closed_at = NOW() WHERE id = v_session_b;
  END IF;

  -- Create/update primary session
  IF v_primary_session IS NULL THEN
    -- Create new FREE session for primary table
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    VALUES (p_venue_id, v_primary_table, 'FREE', NOW());
  END IF;

  -- Create link record (secondary -> primary)
  INSERT INTO table_session_links (venue_id, table_id, linked_to_table_id, created_at)
  VALUES (p_venue_id, v_secondary_table, v_primary_table, NOW())
  ON CONFLICT (table_id) DO UPDATE SET
    linked_to_table_id = v_primary_table,
    updated_at = NOW();

  -- Return success info
  RETURN json_build_object(
    'success', true,
    'primary_table', v_primary_table,
    'secondary_table', v_secondary_table,
    'primary_label', v_primary_label,
    'secondary_label', v_secondary_label,
    'merged_at', NOW()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION api_merge_tables(TEXT, UUID, UUID) TO anon, authenticated;
