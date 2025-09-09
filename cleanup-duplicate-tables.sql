-- Cleanup Duplicate Tables Script
-- This script removes duplicate tables, keeping only the oldest one for each table number per venue

-- First, let's see what duplicates we have
SELECT 
    venue_id,
    label,
    COUNT(*) as duplicate_count,
    MIN(created_at) as oldest_created,
    MAX(created_at) as newest_created
FROM tables 
WHERE is_active = true
GROUP BY venue_id, label
HAVING COUNT(*) > 1
ORDER BY venue_id, label;

-- Delete duplicate tables, keeping only the oldest one for each venue_id + label combination
WITH duplicate_tables AS (
    SELECT 
        id,
        venue_id,
        label,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY venue_id, label 
            ORDER BY created_at ASC
        ) as rn
    FROM tables 
    WHERE is_active = true
)
DELETE FROM tables 
WHERE id IN (
    SELECT id 
    FROM duplicate_tables 
    WHERE rn > 1
);

-- Also clean up any orphaned table_sessions that reference deleted tables
DELETE FROM table_sessions 
WHERE table_id NOT IN (
    SELECT id FROM tables WHERE is_active = true
);

-- Verify the cleanup worked
SELECT 
    venue_id,
    label,
    COUNT(*) as table_count
FROM tables 
WHERE is_active = true
GROUP BY venue_id, label
ORDER BY venue_id, label;
