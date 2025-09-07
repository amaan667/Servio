-- =====================================================
-- FIX TABLE_SESSIONS STATUS COLUMN
-- =====================================================
-- This script adds the missing status column to table_sessions table

-- First, let's check what columns exist and add the status column if missing
DO $$
BEGIN
    -- Check if status column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'table_sessions' 
        AND column_name = 'status'
    ) THEN
        -- Add the status column
        ALTER TABLE table_sessions 
        ADD COLUMN status TEXT DEFAULT 'FREE' 
        CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED'));
        
        RAISE NOTICE 'Added status column to table_sessions table';
    ELSE
        RAISE NOTICE 'Status column already exists in table_sessions table';
    END IF;
END $$;

-- Create index on status column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);

-- Update any existing rows to have a default status
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL;

-- Make status column NOT NULL after setting defaults
ALTER TABLE table_sessions 
ALTER COLUMN status SET NOT NULL;

RAISE NOTICE 'Table sessions status column fix completed successfully!';
