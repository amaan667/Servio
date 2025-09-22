-- Complete SQL script to create table_group_sessions table and all related components
-- Run this in your Supabase SQL Editor

-- 1. Create the main table_group_sessions table
CREATE TABLE IF NOT EXISTS table_group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  table_number INTEGER NOT NULL,
  total_group_size INTEGER NOT NULL DEFAULT 1,
  current_group_size INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_table_group_sessions_venue_table ON table_group_sessions(venue_id, table_number);
CREATE INDEX IF NOT EXISTS idx_table_group_sessions_active ON table_group_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_table_group_sessions_created_at ON table_group_sessions(created_at);

-- 3. Add RLS (Row Level Security) policies
ALTER TABLE table_group_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage group sessions (for API access)
CREATE POLICY "Service role can manage group sessions" ON table_group_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read group sessions for their venues
CREATE POLICY "Users can read group sessions for their venues" ON table_group_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venues 
      WHERE venues.venue_id = table_group_sessions.venue_id 
      AND venues.owner_id = auth.uid()
    )
  );

-- 4. Add helpful comments
COMMENT ON TABLE table_group_sessions IS 'Tracks group sessions for tables to manage seat counts and group orders';
COMMENT ON COLUMN table_group_sessions.venue_id IS 'ID of the venue';
COMMENT ON COLUMN table_group_sessions.table_number IS 'Table number within the venue';
COMMENT ON COLUMN table_group_sessions.total_group_size IS 'Total number of people expected at this table (maximum across all group members)';
COMMENT ON COLUMN table_group_sessions.current_group_size IS 'Current number of people who have joined this group session';
COMMENT ON COLUMN table_group_sessions.is_active IS 'Whether this group session is currently active';

-- 5. Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_table_group_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to automatically update updated_at
CREATE TRIGGER update_table_group_sessions_updated_at_trigger
  BEFORE UPDATE ON table_group_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_table_group_sessions_updated_at();

-- 7. Create a function to clean up old inactive group sessions (optional)
CREATE OR REPLACE FUNCTION cleanup_old_group_sessions()
RETURNS void AS $$
BEGIN
  -- Delete group sessions that have been inactive for more than 24 hours
  DELETE FROM table_group_sessions 
  WHERE is_active = false 
  AND updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 8. Create a view for easy querying of active group sessions with venue info
CREATE OR REPLACE VIEW active_group_sessions AS
SELECT 
  tgs.id,
  tgs.venue_id,
  v.name as venue_name,
  tgs.table_number,
  tgs.total_group_size,
  tgs.current_group_size,
  tgs.created_at,
  tgs.updated_at
FROM table_group_sessions tgs
JOIN venues v ON v.venue_id = tgs.venue_id
WHERE tgs.is_active = true
ORDER BY tgs.venue_id, tgs.table_number;

-- Success message
SELECT 'Table group_sessions created successfully with all indexes, policies, and helper functions!' as result;
