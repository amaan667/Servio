-- =====================================================
-- ADD STATUS COLUMN TO TABLE_SESSIONS FIRST
-- =====================================================
-- Run this script FIRST to add the missing status column

-- Add status column to table_sessions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'table_sessions' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE table_sessions 
        ADD COLUMN status TEXT DEFAULT 'FREE' 
        CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED'));
        
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

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Status column setup completed successfully!';
END $$;
