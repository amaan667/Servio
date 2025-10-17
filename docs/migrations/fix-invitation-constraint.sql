-- Fix invitation constraint to allow multiple invitations to same email
-- Only prevent duplicate PENDING invitations

-- Drop the existing unique constraint
ALTER TABLE staff_invitations 
DROP CONSTRAINT IF EXISTS staff_invitations_venue_id_email_status_key;

-- Create a partial unique index that only enforces uniqueness for pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitations_unique_pending 
ON staff_invitations (venue_id, email) 
WHERE status = 'pending';

-- This allows:
-- - Multiple invitations to the same email (if they're accepted/cancelled/expired)
-- - Only one pending invitation per email per venue
-- - Resending invitations to the same email

