-- =====================================================
-- FINAL FIX FOR TABLE_SESSIONS STATUS COLUMN
-- =====================================================
-- This script handles the status column issue completely

-- First, let's check what we're working with
SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
AND column_name = 'status';

-- Check if there are any existing rows
SELECT COUNT(*) as total_rows, 
       COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as non_null_status
FROM table_sessions;

-- Show current status values
SELECT DISTINCT status, COUNT(*) as count 
FROM table_sessions 
GROUP BY status 
ORDER BY status;

-- =====================================================
-- STEP 1: DROP ENUM TYPE IF IT EXISTS
-- =====================================================

-- Drop the enum type if it exists (this will fail if it's in use, that's ok)
DROP TYPE IF EXISTS table_status CASCADE;

-- =====================================================
-- STEP 2: ENSURE STATUS COLUMN EXISTS AS TEXT
-- =====================================================

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

-- =====================================================
-- STEP 3: CONVERT COLUMN TO TEXT IF IT'S NOT ALREADY
-- =====================================================

-- Convert the column to TEXT if it's currently an enum
DO $$
BEGIN
    -- Check if the column is currently an enum type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'table_sessions' 
        AND column_name = 'status'
        AND udt_name != 'text'
        AND table_schema = 'public'
    ) THEN
        -- Convert to text
        ALTER TABLE table_sessions 
        ALTER COLUMN status TYPE TEXT;
        
        RAISE NOTICE 'Converted status column to TEXT type';
    ELSE
        RAISE NOTICE 'Status column is already TEXT type';
    END IF;
END $$;

-- =====================================================
-- STEP 4: UPDATE DATA MAPPING
-- =====================================================

-- Update existing data to map to new values
UPDATE table_sessions 
SET status = CASE 
  WHEN status IN ('FREE') THEN 'FREE'
  WHEN status IN ('ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'OCCUPIED', 'RESERVED', 'CLOSED') THEN 'OCCUPIED'
  ELSE 'FREE'  -- Default fallback
END;

-- Show updated status values
SELECT DISTINCT status, COUNT(*) as count 
FROM table_sessions 
GROUP BY status 
ORDER BY status;

-- =====================================================
-- STEP 5: CREATE ENUM TYPE AND CONVERT
-- =====================================================

-- Create the enum type
CREATE TYPE table_status AS ENUM ('FREE', 'OCCUPIED');

-- Remove any existing constraints
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS table_sessions_status_check;

-- Remove the default value to avoid casting issues
ALTER TABLE table_sessions 
ALTER COLUMN status DROP DEFAULT;

-- Convert the column to enum type
ALTER TABLE table_sessions 
ALTER COLUMN status TYPE table_status USING status::table_status;

-- Set the new default value
ALTER TABLE table_sessions 
ALTER COLUMN status SET DEFAULT 'FREE'::table_status;

-- =====================================================
-- STEP 6: VERIFY THE RESULT
-- =====================================================

-- Check the final column definition
SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
AND column_name = 'status';

-- Show final status values
SELECT DISTINCT status, COUNT(*) as count 
FROM table_sessions 
GROUP BY status 
ORDER BY status;

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Table sessions status column fix completed successfully!';
    RAISE NOTICE 'Status column is now properly configured as table_status enum';
END $$;
