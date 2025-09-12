-- Create daily_reset_log table to track when daily resets have been performed
CREATE TABLE IF NOT EXISTS daily_reset_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id TEXT NOT NULL,
  reset_date DATE NOT NULL,
  reset_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_orders INTEGER DEFAULT 0,
  canceled_reservations INTEGER DEFAULT 0,
  reset_tables INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one reset per venue per day
  UNIQUE(venue_id, reset_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_reset_log_venue_date ON daily_reset_log(venue_id, reset_date);

-- Add RLS policies
ALTER TABLE daily_reset_log ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to manage reset logs
CREATE POLICY "Service role can manage daily reset logs" ON daily_reset_log
  FOR ALL USING (auth.role() = 'service_role');

-- Policy to allow venue owners to read their reset logs
CREATE POLICY "Venue owners can read their reset logs" ON daily_reset_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venues 
      WHERE venues.venue_id = daily_reset_log.venue_id 
      AND venues.owner_id = auth.uid()
    )
  );
