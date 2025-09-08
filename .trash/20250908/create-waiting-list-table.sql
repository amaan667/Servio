-- =====================================================
-- WAITING LIST TABLE
-- =====================================================
-- Table to track parties waiting to be seated

CREATE TABLE IF NOT EXISTS waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  status TEXT DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'SEATED', 'CANCELLED', 'NO_SHOW')),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  seated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_waiting_list_venue_id ON waiting_list(venue_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_status ON waiting_list(status);
CREATE INDEX IF NOT EXISTS idx_waiting_list_created_at ON waiting_list(created_at);

-- Enable RLS
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "venue_owner_can_manage_waiting_list" ON waiting_list
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.venue_id = waiting_list.venue_id 
      AND v.owner_id = auth.uid()
    )
  );

-- Function to seat a waiting party
CREATE OR REPLACE FUNCTION api_seat_waiting_party(
  p_waiting_id UUID,
  p_table_id UUID,
  p_venue_id TEXT
)
RETURNS JSON AS $$
DECLARE
  v_waiting RECORD;
  v_table RECORD;
  v_result JSON;
BEGIN
  -- Get waiting party details
  SELECT * INTO v_waiting
  FROM waiting_list 
  WHERE id = p_waiting_id AND venue_id = p_venue_id AND status = 'WAITING';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Waiting party not found');
  END IF;
  
  -- Get table details
  SELECT * INTO v_table
  FROM tables 
  WHERE id = p_table_id AND venue_id = p_venue_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or inactive');
  END IF;
  
  -- Update waiting party status
  UPDATE waiting_list 
  SET status = 'SEATED', table_id = p_table_id, seated_at = NOW(), updated_at = NOW()
  WHERE id = p_waiting_id;
  
  -- Seat the party at the table
  PERFORM api_seat_party(p_table_id, p_venue_id, NULL, NULL);
  
  v_result := json_build_object(
    'success', true,
    'waiting_id', p_waiting_id,
    'table_id', p_table_id,
    'customer_name', v_waiting.customer_name,
    'party_size', v_waiting.party_size,
    'message', 'Party seated successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION api_seat_waiting_party(UUID, UUID, TEXT) TO authenticated;
