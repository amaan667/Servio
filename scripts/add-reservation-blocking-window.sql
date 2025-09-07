-- Add reservation blocking window column to venues table
-- This allows venues to configure how far in advance reservations should block tables

-- Add the column
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reservation_blocking_minutes INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN venues.reservation_blocking_minutes IS 'Minutes before reservation start time when table should be marked as reserved. NULL = use business_type default (RESTAURANT: 30min, CAFE: 0min)';

-- Update existing venues based on business type
UPDATE venues 
SET reservation_blocking_minutes = CASE 
  WHEN business_type = 'RESTAURANT' THEN 30
  WHEN business_type = 'CAFE' THEN 0
  ELSE 0
END
WHERE reservation_blocking_minutes IS NULL;
