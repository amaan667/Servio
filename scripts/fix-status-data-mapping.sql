-- =====================================================
-- FIX STATUS DATA MAPPING
-- =====================================================
-- This script fixes the data mapping before converting to enum

-- First, let's see what status values currently exist
SELECT DISTINCT status, COUNT(*) as count 
FROM table_sessions 
GROUP BY status 
ORDER BY status;

-- Update existing data to map to new enum values
-- FREE = available for seating
-- OCCUPIED = currently seated (any active session)
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

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Status data mapping completed successfully!';
    RAISE NOTICE 'All status values have been mapped to FREE or OCCUPIED';
END $$;
