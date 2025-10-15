-- Manual fix for staff_invitations constraint
-- Run this in your Supabase dashboard SQL editor

-- Step 1: Drop the existing unique constraint that includes status
ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;

-- Step 2: Create a new partial unique index that only prevents multiple pending invitations
-- This allows cancelled invitations to be completely removed and new ones to be created
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
ON staff_invitations (venue_id, email) 
WHERE status = 'pending';

-- Step 3: Add a comment explaining the constraint
COMMENT ON INDEX idx_staff_invitations_unique_pending IS 'Ensures only one pending invitation per email per venue, allowing cancelled invitations to be removed and new ones created';

-- Verify the fix worked by checking the constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'staff_invitations'::regclass;

-- Check the indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'staff_invitations';
