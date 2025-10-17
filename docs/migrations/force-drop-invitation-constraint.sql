-- Force drop the invitation constraint
-- This will remove any existing constraint that's blocking duplicate invitations

-- Drop the unique constraint if it exists (with all possible names)
ALTER TABLE staff_invitations 
DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;

ALTER TABLE staff_invitations 
DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_key;

-- Drop any existing partial index
DROP INDEX IF EXISTS idx_staff_invitations_unique_pending;

-- Create the new partial unique index that only enforces uniqueness for pending invitations
CREATE UNIQUE INDEX idx_staff_invitations_unique_pending 
ON staff_invitations (venue_id, email) 
WHERE status = 'pending';

-- Verify the constraint is gone
-- You should be able to insert multiple invitations for the same email now
-- (as long as only one is pending)

