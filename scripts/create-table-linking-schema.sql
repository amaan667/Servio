-- Table Linking Schema for Merge Tables Functionality
-- This script creates the table_session_links table and related functions

-- 1. Create table_session_links table
CREATE TABLE IF NOT EXISTS table_session_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (table_id)  -- A table can link to only one primary session
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_links_session ON table_session_links(session_id);
CREATE INDEX IF NOT EXISTS idx_links_table ON table_session_links(table_id);

-- 3. Enable RLS
ALTER TABLE table_session_links ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Users can view table links for their venues" ON table_session_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tables t
      JOIN venues v ON t.venue_id = v.venue_id
      JOIN auth.users u ON v.owner_id = u.id
      WHERE t.id = table_session_links.table_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage table links for their venues" ON table_session_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tables t
      JOIN venues v ON t.venue_id = v.venue_id
      JOIN auth.users u ON v.owner_id = u.id
      WHERE t.id = table_session_links.table_id
      AND u.id = auth.uid()
    )
  );

-- 5. Merge Tables Function
CREATE OR REPLACE FUNCTION api_merge_tables(
  p_venue_id UUID,
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

  -- Check for existing reservations
  DECLARE
    v_reservation_a BOOLEAN := FALSE;
    v_reservation_b BOOLEAN := FALSE;
  BEGIN
    -- Check if table A has an active reservation
    SELECT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.venue_id = p_venue_id AND r.table_id = p_table_a
        AND r.status = 'BOOKED' AND r.start_at <= NOW() AND r.end_at >= NOW()
    ) INTO v_reservation_a;

    -- Check if table B has an active reservation
    SELECT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.venue_id = p_venue_id AND r.table_id = p_table_b
        AND r.status = 'BOOKED' AND r.start_at <= NOW() AND r.end_at >= NOW()
    ) INTO v_reservation_b;

    -- Eligibility logic:
    -- FREE + FREE
    IF v_status_a = 'FREE' AND v_status_b = 'FREE' AND NOT v_reservation_a AND NOT v_reservation_b THEN
      v_primary_table := p_table_a;  -- Arbitrary, keep A as primary
      v_secondary_table := p_table_b;
      v_primary_label := v_table_a_label;
      v_secondary_label := v_table_b_label;

      -- Ensure A has a FREE session
      IF v_session_a IS NULL THEN
        INSERT INTO table_sessions (venue_id, table_id, status) VALUES (p_venue_id, p_table_a, 'FREE') RETURNING id INTO v_session_a;
      END IF;
      v_primary_session := v_session_a;

    -- RESERVED + FREE (table with reservation is primary)
    ELSIF v_status_a = 'FREE' AND NOT v_reservation_a AND v_reservation_b THEN
      v_primary_table := p_table_b;
      v_secondary_table := p_table_a;
      v_primary_label := v_table_b_label;
      v_secondary_label := v_table_a_label;

      -- Free session on B (or create), stays FREE until check-in
      IF v_session_b IS NULL THEN
        INSERT INTO table_sessions (venue_id, table_id, status) VALUES (p_venue_id, p_table_b, 'FREE') RETURNING id INTO v_session_b;
      END IF;
      v_primary_session := v_session_b;

    ELSIF v_status_b = 'FREE' AND NOT v_reservation_b AND v_reservation_a THEN
      v_primary_table := p_table_a;
      v_secondary_table := p_table_b;
      v_primary_label := v_table_a_label;
      v_secondary_label := v_table_b_label;

      IF v_session_a IS NULL THEN
        INSERT INTO table_sessions (venue_id, table_id, status) VALUES (p_venue_id, p_table_a, 'FREE') RETURNING id INTO v_session_a;
      END IF;
      v_primary_session := v_session_a;

    -- OCCUPIED + FREE
    ELSIF v_status_a = 'OCCUPIED' AND v_status_b = 'FREE' AND NOT v_reservation_b THEN
      v_primary_table := p_table_a;
      v_secondary_table := p_table_b;
      v_primary_label := v_table_a_label;
      v_secondary_label := v_table_b_label;
      v_primary_session := v_session_a;

    ELSIF v_status_b = 'OCCUPIED' AND v_status_a = 'FREE' AND NOT v_reservation_a THEN
      v_primary_table := p_table_b;
      v_secondary_table := p_table_a;
      v_primary_label := v_table_b_label;
      v_secondary_label := v_table_a_label;
      v_primary_session := v_session_b;

    ELSE
      -- Disallowed combos: RESERVED+RESERVED, OCCUPIED+OCCUPIED, etc.
      RAISE EXCEPTION 'Merge not allowed for these table states. Can only merge FREE tables with FREE, RESERVED, or OCCUPIED tables.';
    END IF;
  END;

  -- Make sure the secondary is not already linked
  IF EXISTS (SELECT 1 FROM table_session_links WHERE table_id = v_secondary_table) THEN
    RAISE EXCEPTION 'Secondary table already linked to another session';
  END IF;

  -- Link the secondary to the primary session
  INSERT INTO table_session_links(session_id, table_id)
  VALUES (v_primary_session, v_secondary_table);

  -- Ensure the secondary has no open session (close if exists)
  UPDATE table_sessions SET closed_at = NOW()
  WHERE table_id = v_secondary_table AND closed_at IS NULL;

  -- Return success with table info
  RETURN json_build_object(
    'success', true,
    'primary_table', v_primary_table,
    'secondary_table', v_secondary_table,
    'primary_label', v_primary_label,
    'secondary_label', v_secondary_label,
    'session_id', v_primary_session
  );
END;
$$;

-- 6. Unmerge Function
CREATE OR REPLACE FUNCTION api_unmerge_table(
  p_secondary_table_id UUID
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_venue_id UUID;
  v_table_label TEXT;
BEGIN
  -- Get venue and table info
  SELECT t.venue_id, t.label INTO v_venue_id, v_table_label
  FROM tables t WHERE t.id = p_secondary_table_id;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  -- Remove link
  DELETE FROM table_session_links WHERE table_id = p_secondary_table_id;

  -- Re-open FREE session for that table
  INSERT INTO table_sessions(venue_id, table_id, status) 
  VALUES (v_venue_id, p_secondary_table_id, 'FREE');

  RETURN json_build_object(
    'success', true,
    'table_id', p_secondary_table_id,
    'table_label', v_table_label
  );
END;
$$;

-- 7. Function to get active session (for QR routing)
CREATE OR REPLACE FUNCTION get_active_session_for_table(p_table_id UUID)
RETURNS TABLE (
  session_id UUID,
  table_id UUID,
  status TEXT,
  order_id UUID,
  opened_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First, try to get direct session
  RETURN QUERY
  SELECT s.id, s.table_id, s.status::TEXT, s.order_id, s.opened_at
  FROM table_sessions s
  WHERE s.table_id = p_table_id AND s.closed_at IS NULL;

  -- If no direct session, check if table is linked
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT s.id, s.table_id, s.status::TEXT, s.order_id, s.opened_at
    FROM table_session_links l
    JOIN table_sessions s ON l.session_id = s.id
    WHERE l.table_id = p_table_id AND s.closed_at IS NULL;
  END IF;
END;
$$;

-- 8. Updated table counters function
CREATE OR REPLACE FUNCTION get_table_counts_with_links(p_venue_id UUID)
RETURNS TABLE (
  total_tables BIGINT,
  available BIGINT,
  occupied BIGINT,
  reserved BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH cur_sessions AS (
    SELECT s.table_id, s.status
    FROM table_sessions s
    WHERE s.closed_at IS NULL
  ),
  linked_tables AS (
    SELECT table_id FROM table_session_links
  ),
  reserved_now AS (
    SELECT COUNT(*) as reserved_count
    FROM reservations r
    WHERE r.venue_id = p_venue_id AND r.status = 'BOOKED'
      AND r.start_at <= NOW() AND r.end_at >= NOW()
  )
  SELECT
    (SELECT COUNT(*) FROM tables t WHERE t.venue_id = p_venue_id AND t.is_active) as total_tables,
    (SELECT COUNT(*) FROM cur_sessions c
      LEFT JOIN linked_tables l ON l.table_id = c.table_id
      WHERE c.status = 'FREE' AND l.table_id IS NULL) as available,
    (
      -- Occupied session owners
      (SELECT COUNT(*) FROM cur_sessions c WHERE c.status = 'OCCUPIED')
      +
      -- Secondaries linked to any session (treat as occupied/unavailable)
      (SELECT COUNT(*) FROM linked_tables)
    ) as occupied,
    (SELECT reserved_count FROM reserved_now) as reserved;
END;
$$;

-- 9. Function to close table and unlink secondaries
CREATE OR REPLACE FUNCTION close_table_with_unlink(p_table_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_venue_id UUID;
  v_session_id UUID;
  v_secondary_tables UUID[];
BEGIN
  -- Get venue and current session
  SELECT t.venue_id, s.id INTO v_venue_id, v_session_id
  FROM tables t
  LEFT JOIN table_sessions s ON t.id = s.table_id AND s.closed_at IS NULL
  WHERE t.id = p_table_id;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  -- Get all secondary tables linked to this session
  SELECT ARRAY_AGG(table_id) INTO v_secondary_tables
  FROM table_session_links
  WHERE session_id = v_session_id;

  -- Close current session
  UPDATE table_sessions SET 
    status = 'CLOSED',
    closed_at = NOW(),
    updated_at = NOW()
  WHERE table_id = p_table_id AND closed_at IS NULL;

  -- Unlink all secondary tables and create FREE sessions for them
  IF v_secondary_tables IS NOT NULL THEN
    DELETE FROM table_session_links WHERE session_id = v_session_id;
    
    INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
    SELECT v_venue_id, unnest(v_secondary_tables), 'FREE', NOW();
  END IF;

  -- Create new FREE session for primary table
  INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
  VALUES (v_venue_id, p_table_id, 'FREE', NOW());

  RETURN json_build_object(
    'success', true,
    'unlinked_tables', COALESCE(v_secondary_tables, ARRAY[]::UUID[])
  );
END;
$$;
