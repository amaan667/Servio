-- Fix table_session_links schema to support the merge tables functionality
-- This adds the missing venue_id and linked_to_table_id columns

-- Add missing columns to table_session_links table
ALTER TABLE table_session_links 
ADD COLUMN IF NOT EXISTS venue_id TEXT,
ADD COLUMN IF NOT EXISTS linked_to_table_id UUID,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add foreign key constraints
ALTER TABLE table_session_links 
ADD CONSTRAINT fk_links_venue_id 
FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE CASCADE;

ALTER TABLE table_session_links 
ADD CONSTRAINT fk_links_linked_to_table 
FOREIGN KEY (linked_to_table_id) REFERENCES tables(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_links_venue_id ON table_session_links(venue_id);
CREATE INDEX IF NOT EXISTS idx_links_linked_to_table ON table_session_links(linked_to_table_id);

-- Update RLS policies to include venue_id check
DROP POLICY IF EXISTS "Users can view table links for their venues" ON table_session_links;
DROP POLICY IF EXISTS "Users can manage table links for their venues" ON table_session_links;

CREATE POLICY "Users can view table links for their venues" ON table_session_links
  FOR SELECT USING (
    venue_id IN (
      SELECT venue_id FROM venues 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage table links for their venues" ON table_session_links
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM venues 
      WHERE owner_id = auth.uid()
    )
  );

-- Add comment explaining the table structure
COMMENT ON TABLE table_session_links IS 'Links secondary tables to primary table sessions for merge functionality';
COMMENT ON COLUMN table_session_links.venue_id IS 'Venue ID for the tables being linked';
COMMENT ON COLUMN table_session_links.table_id IS 'Secondary table ID that is being linked';
COMMENT ON COLUMN table_session_links.linked_to_table_id IS 'Primary table ID that the secondary table is linked to';
COMMENT ON COLUMN table_session_links.session_id IS 'Session ID of the primary table (legacy column)';
