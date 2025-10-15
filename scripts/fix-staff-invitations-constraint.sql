-- Fix staff_invitations table constraint to allow proper cancellation and re-invitation
-- This script removes the status from the unique constraint and adds a proper constraint

-- Drop the existing unique constraint that includes status
ALTER TABLE staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;

-- Add a new unique constraint that only prevents multiple pending invitations for the same email/venue
-- This allows cancelled invitations to be completely removed and new ones to be created
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
ON staff_invitations (venue_id, email) 
WHERE status = 'pending';

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_staff_invitations_unique_pending IS 'Ensures only one pending invitation per email per venue, allowing cancelled invitations to be removed and new ones created';
