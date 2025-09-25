-- DELETE TABLES FROM YESTERDAY
-- This will remove all tables created before today

-- First, check what tables exist and when they were created
SELECT 
    'Current tables before deletion:' as info,
    id,
    label,
    created_at,
    DATE(created_at) as created_date,
    is_active
FROM tables 
WHERE venue_id = 'YOUR_VENUE_ID_HERE' -- Replace with your actual venue ID
ORDER BY created_at DESC;

-- Delete all table sessions for tables created before today
DELETE FROM table_sessions 
WHERE venue_id = 'YOUR_VENUE_ID_HERE' 
  AND table_id IN (
    SELECT id FROM tables 
    WHERE venue_id = 'YOUR_VENUE_ID_HERE'
      AND DATE(created_at) < CURRENT_DATE
  );

-- Delete all tables created before today
DELETE FROM tables 
WHERE venue_id = 'YOUR_VENUE_ID_HERE'
  AND DATE(created_at) < CURRENT_DATE;

-- Note: table_runtime_state is a view and will update automatically 
-- when we delete the base tables and sessions above

-- Check results
SELECT 
    'Tables remaining after deletion:' as info,
    COUNT(*) as remaining_table_count
FROM tables 
WHERE venue_id = 'YOUR_VENUE_ID_HERE';

SELECT 
    'Remaining tables:' as info,
    id,
    label,
    created_at,
    DATE(created_at) as created_date
FROM tables 
WHERE venue_id = 'YOUR_VENUE_ID_HERE'
ORDER BY created_at DESC;
