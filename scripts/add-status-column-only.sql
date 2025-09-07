-- =====================================================
-- ADD STATUS COLUMN ONLY - MINIMAL SCRIPT
-- =====================================================
-- This script ONLY adds the status column to table_sessions
-- Run this FIRST before any other table management scripts

-- Check if table_sessions exists, if not create it
CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  table_id UUID NOT NULL,
  order_id UUID,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'table_sessions' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE table_sessions 
        ADD COLUMN status TEXT DEFAULT 'FREE';
        
        RAISE NOTICE 'Added status column to table_sessions table';
    ELSE
        RAISE NOTICE 'Status column already exists in table_sessions table';
    END IF;
END $$;

-- Update any existing rows to have a default status
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL;

-- Make status column NOT NULL after setting defaults
ALTER TABLE table_sessions 
ALTER COLUMN status SET NOT NULL;

-- Create index on status column
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);

-- Add check constraint
ALTER TABLE table_sessions 
ADD CONSTRAINT table_sessions_status_check 
CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED'));

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Status column setup completed successfully!';
    RAISE NOTICE 'You can now run the full table management refactor script.';
END $$;
