-- Fix RLS policies for table_session_links to work with the merge function
-- The issue is that the merge function runs as a database function, not as a user

-- First, let's check if we need to add venue_id column (in case the previous fix wasn't applied)
ALTER TABLE table_session_links 
ADD COLUMN IF NOT EXISTS venue_id TEXT;

-- Add foreign key constraint for venue_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_links_venue_id' 
        AND table_name = 'table_session_links'
    ) THEN
        ALTER TABLE table_session_links 
        ADD CONSTRAINT fk_links_venue_id 
        FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view table links for their venues" ON table_session_links;
DROP POLICY IF EXISTS "Users can manage table links for their venues" ON table_session_links;

-- Create new policies that work with both the original schema and the merge function
-- Policy 1: Users can view table links for their venues (based on table_id)
CREATE POLICY "Users can view table links for their venues" ON table_session_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tables t
      JOIN venues v ON t.venue_id = v.venue_id
      WHERE t.id = table_session_links.table_id
      AND v.owner_id = auth.uid()
    )
  );

-- Policy 2: Users can manage table links for their venues (based on table_id)
CREATE POLICY "Users can manage table links for their venues" ON table_session_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tables t
      JOIN venues v ON t.venue_id = v.venue_id
      WHERE t.id = table_session_links.table_id
      AND v.owner_id = auth.uid()
    )
  );

-- Policy 3: Allow service role to bypass RLS for database functions
-- This is needed for the merge function to work
CREATE POLICY "Service role can manage table links" ON table_session_links
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- Update the merge function to set venue_id when creating links
-- This ensures the venue_id is populated for future queries
CREATE OR REPLACE FUNCTION api_merge_tables(
  p_venue_id TEXT,
  p_table_a UUID,
  p_table_b UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS
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

  -- Create/update primary session and get the session_id
  IF v_primary_session IS NULL THEN
    -- Create new FREE session for primary table
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    VALUES (p_venue_id, v_primary_table, 'FREE', NOW())
    RETURNING id INTO v_primary_session;
  END IF;

  -- Create link record (secondary -> primary session)
  -- Include venue_id for proper RLS and future queries
  INSERT INTO table_session_links (session_id, table_id, venue_id, created_at)
  VALUES (v_primary_session, v_secondary_table, p_venue_id, NOW())
  ON CONFLICT (table_id) DO UPDATE SET
    session_id = v_primary_session,
    venue_id = p_venue_id,
    created_at = NOW();

  -- Return success info
  RETURN json_build_object(
    'success', true,
    'primary_table', v_primary_table,
    'secondary_table', v_secondary_table,
    'primary_label', v_primary_label,
    'secondary_label', v_secondary_label,
    'session_id', v_primary_session,
    'merged_at', NOW()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION api_merge_tables(TEXT, UUID, UUID) TO anon, authenticated;
