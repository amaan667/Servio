-- Add 'deleted' status to staff_invitations table
-- This allows us to mark invitations as deleted without constraint conflicts

-- First, drop the existing check constraint
ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_status_check;

-- Add the new check constraint that includes 'deleted' status
ALTER TABLE staff_invitations ADD CONSTRAINT staff_invitations_status_check 
CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'deleted'));

-- Update any existing 'cancelled' invitations to 'deleted' to avoid constraint issues
UPDATE staff_invitations SET status = 'deleted' WHERE status = 'cancelled';

-- Drop the problematic unique constraint that includes status
ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;

-- Create a new partial unique index that only prevents multiple pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
ON staff_invitations (venue_id, email) 
WHERE status = 'pending';

-- Add comment explaining the constraint
COMMENT ON INDEX idx_staff_invitations_unique_pending IS 'Ensures only one pending invitation per email per venue, allowing deleted invitations to be created without conflicts';
