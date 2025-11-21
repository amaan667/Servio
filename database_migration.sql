-- ============================================
-- ONBOARDING PROGRESS TABLE
-- ============================================
-- Server-side progress tracking for onboarding wizard
CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);

-- Add RLS (Row Level Security) policy
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view their own onboarding progress" ON onboarding_progress;
DROP POLICY IF EXISTS "Users can update their own onboarding progress" ON onboarding_progress;
DROP POLICY IF EXISTS "Users can insert their own onboarding progress" ON onboarding_progress;

CREATE POLICY "Users can view their own onboarding progress"
  ON onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding progress"
  ON onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- VENUE SETTINGS TABLE
-- ============================================
-- Stores business hours, tax settings, and other venue configuration
CREATE TABLE IF NOT EXISTS venue_settings (
  venue_id TEXT PRIMARY KEY REFERENCES venues(venue_id) ON DELETE CASCADE,
  business_hours JSONB,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_included BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_venue_settings_venue_id ON venue_settings(venue_id);

-- Add RLS (Row Level Security) policy
ALTER TABLE venue_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view venue settings for their venues" ON venue_settings;
DROP POLICY IF EXISTS "Users can update venue settings for their venues" ON venue_settings;
DROP POLICY IF EXISTS "Users can insert venue settings for their venues" ON venue_settings;

CREATE POLICY "Users can view venue settings for their venues"
  ON venue_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = venue_settings.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update venue settings for their venues"
  ON venue_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = venue_settings.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert venue settings for their venues"
  ON venue_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = venue_settings.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  );

-- ============================================
-- VENUES TABLE COLUMNS
-- ============================================
-- Ensure venues table has address and phone columns
DO $$ 
BEGIN
  -- Add address column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'address'
  ) THEN
    ALTER TABLE venues ADD COLUMN address TEXT;
  END IF;

  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'phone'
  ) THEN
    ALTER TABLE venues ADD COLUMN phone TEXT;
  END IF;
END $$;

-- ============================================
-- TABLES TABLE COLUMNS
-- ============================================
-- Ensure tables table has label, section, and seat_count columns
DO $$ 
BEGIN
  -- Add label column if it doesn't exist (for custom table names)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tables' AND column_name = 'label'
  ) THEN
    ALTER TABLE tables ADD COLUMN label TEXT;
    -- Set default label from table_number for existing rows
    UPDATE tables SET label = 'Table ' || table_number::TEXT WHERE label IS NULL;
  END IF;

  -- Add section column if it doesn't exist (for table sections/areas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tables' AND column_name = 'section'
  ) THEN
    ALTER TABLE tables ADD COLUMN section TEXT DEFAULT 'Main';
    -- Set default section for existing rows
    UPDATE tables SET section = 'Main' WHERE section IS NULL;
  END IF;

  -- Add seat_count column if it doesn't exist (for table capacity)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tables' AND column_name = 'seat_count'
  ) THEN
    ALTER TABLE tables ADD COLUMN seat_count INTEGER DEFAULT 4;
    -- Set default capacity for existing rows
    UPDATE tables SET seat_count = 4 WHERE seat_count IS NULL;
  END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- Create indexes for commonly queried columns

-- Index on tables.venue_id and section for filtering
CREATE INDEX IF NOT EXISTS idx_tables_venue_section 
  ON tables(venue_id, section) 
  WHERE is_active = true;

-- Index on tables.label for searching
CREATE INDEX IF NOT EXISTS idx_tables_label 
  ON tables(venue_id, label) 
  WHERE is_active = true;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE onboarding_progress IS 'Tracks user progress through the onboarding wizard';
COMMENT ON COLUMN onboarding_progress.current_step IS 'Current step number (1-4)';
COMMENT ON COLUMN onboarding_progress.completed_steps IS 'Array of completed step numbers';
COMMENT ON COLUMN onboarding_progress.data IS 'Additional progress data stored as JSON';

COMMENT ON TABLE venue_settings IS 'Stores venue-specific settings like business hours and tax configuration';
COMMENT ON COLUMN venue_settings.business_hours IS 'JSON object with hours for each day: {monday: {open: "09:00", close: "17:00", closed: false}, ...}';
COMMENT ON COLUMN venue_settings.tax_rate IS 'Tax/VAT rate as percentage (e.g., 20 for 20%)';
COMMENT ON COLUMN venue_settings.tax_included IS 'Whether prices include tax (true) or tax is added on top (false)';

COMMENT ON COLUMN tables.label IS 'Custom table name/label (e.g., "Table 1", "Window Seat", "Bar Counter")';
COMMENT ON COLUMN tables.section IS 'Table section/area (e.g., "Main", "Patio", "Bar", "VIP")';
COMMENT ON COLUMN tables.seat_count IS 'Number of seats/capacity for this table';


