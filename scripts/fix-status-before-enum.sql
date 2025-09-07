-- =====================================================
-- FIX STATUS DATA BEFORE ENUM CONVERSION
-- =====================================================
-- This script fixes the data mapping BEFORE converting to enum type

-- First, let's see what status values currently exist
SELECT DISTINCT status, COUNT(*) as count 
FROM table_sessions 
GROUP BY status 
ORDER BY status;

-- Drop the enum type if it exists (to start fresh)
DROP TYPE IF EXISTS table_status CASCADE;

-- Update existing data to map to new values BEFORE creating enum
UPDATE table_sessions 
SET status = CASE 
  WHEN status IN ('FREE') THEN 'FREE'
  WHEN status IN ('ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'OCCUPIED', 'RESERVED', 'CLOSED') THEN 'OCCUPIED'
  ELSE 'FREE'  -- Default fallback
END;

-- Show the updated status distribution
SELECT DISTINCT status, COUNT(*) as count 
FROM table_sessions 
GROUP BY status 
ORDER BY status;

-- Now create the enum type
CREATE TYPE table_status AS ENUM ('FREE', 'OCCUPIED');

-- Remove the check constraint temporarily
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS table_sessions_status_check;

-- Remove the default value to avoid casting issues
ALTER TABLE table_sessions 
ALTER COLUMN status DROP DEFAULT;

-- Now change the column type to enum
ALTER TABLE table_sessions 
ALTER COLUMN status TYPE table_status USING status::table_status;

-- Set the new default value
ALTER TABLE table_sessions 
ALTER COLUMN status SET DEFAULT 'FREE'::table_status;

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Status data mapping and enum conversion completed successfully!';
    RAISE NOTICE 'All status values have been mapped to FREE or OCCUPIED enum';
END $$;
