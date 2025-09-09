-- Simple cleanup script for duplicate tables
-- Run this in your Supabase SQL editor

-- Step 1: See current duplicates
SELECT 
    venue_id,
    label,
    COUNT(*) as count,
    array_agg(id ORDER BY created_at) as table_ids,
    array_agg(created_at ORDER BY created_at) as created_dates
FROM tables 
WHERE is_active = true
GROUP BY venue_id, label
HAVING COUNT(*) > 1
ORDER BY venue_id, label;

-- Step 2: Delete duplicates (keep oldest)
WITH duplicates_to_remove AS (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY venue_id, label 
                ORDER BY created_at ASC
            ) as rn
        FROM tables 
        WHERE is_active = true
    ) ranked
    WHERE rn > 1
)
DELETE FROM tables 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- Step 3: Clean up orphaned sessions
DELETE FROM table_sessions 
WHERE table_id NOT IN (SELECT id FROM tables WHERE is_active = true);

-- Step 4: Verify cleanup
SELECT 
    venue_id,
    label,
    COUNT(*) as remaining_count
FROM tables 
WHERE is_active = true
GROUP BY venue_id, label
ORDER BY venue_id, label;
