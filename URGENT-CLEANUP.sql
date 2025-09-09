-- URGENT: Clean up duplicate tables for venue-1e02af4d
-- Copy and paste this into your Supabase SQL Editor and run it

-- Step 1: See what duplicates exist
SELECT 
    venue_id,
    label,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at) as table_ids,
    array_agg(created_at ORDER BY created_at) as created_dates
FROM tables 
WHERE is_active = true 
  AND venue_id = 'venue-1e02af4d'
GROUP BY venue_id, label
HAVING COUNT(*) > 1
ORDER BY label;

-- Step 2: Delete all duplicate tables (keep only the oldest for each table number)
WITH duplicates_to_remove AS (
    SELECT id
    FROM (
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
          AND venue_id = 'venue-1e02af4d'
    ) ranked
    WHERE rn > 1
)
DELETE FROM tables 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- Step 3: Clean up any orphaned table sessions
DELETE FROM table_sessions 
WHERE table_id NOT IN (
    SELECT id FROM tables WHERE is_active = true
);

-- Step 4: Verify the cleanup worked
SELECT 
    venue_id,
    label,
    COUNT(*) as remaining_count,
    array_agg(id ORDER BY created_at) as remaining_ids
FROM tables 
WHERE is_active = true 
  AND venue_id = 'venue-1e02af4d'
GROUP BY venue_id, label
ORDER BY label;
