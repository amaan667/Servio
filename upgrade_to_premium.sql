-- Upgrade Cafe Nur organization to Premium tier
-- This script updates the subscription tier and status for the Cafe Nur venue

UPDATE organizations
SET 
  subscription_tier = 'premium',
  subscription_status = 'active',
  updated_at = NOW()
WHERE id IN (
  SELECT organization_id 
  FROM venues 
  WHERE venue_name ILIKE '%cafe nur%'
  LIMIT 1
);

-- Verify the update
SELECT 
  o.id,
  o.subscription_tier,
  o.subscription_status,
  v.venue_name,
  v.venue_id
FROM organizations o
JOIN venues v ON v.organization_id = o.id
WHERE v.venue_name ILIKE '%cafe nur%';
