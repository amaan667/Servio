-- Check for duplicate functions
SELECT 
  proname as function_name,
  COUNT(*) as count,
  STRING_AGG(pg_get_function_identity_arguments(oid)::text, ' | ') as arguments
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY proname
HAVING COUNT(*) > 1;

-- Verify get_access_context uses organization_id
SELECT 
  proname,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%organization_id%' THEN 'Uses organization_id ✅'
    ELSE 'Missing organization_id ❌'
  END as status
FROM pg_proc
WHERE proname = 'get_access_context'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Ensure all venues have organization_id set (for enterprise account)
UPDATE venues
SET 
  organization_id = '65493772-a3a7-4f08-a396-ff4c86c2c7e1',
  updated_at = NOW()
WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20'
  AND (organization_id IS NULL OR organization_id != '65493772-a3a7-4f08-a396-ff4c86c2c7e1');

-- Verify setup
SELECT 
  v.venue_id,
  v.venue_name,
  v.organization_id,
  o.subscription_tier,
  o.subscription_status,
  o.stripe_customer_id
FROM venues v
LEFT JOIN organizations o ON o.id = v.organization_id
WHERE v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

