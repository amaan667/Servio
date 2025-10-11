-- IMMEDIATE FIX: Create RBAC entry for existing venue owner
-- Run this to fix your dashboard access

INSERT INTO user_venue_roles (venue_id, user_id, role)
SELECT 
  v.venue_id,
  v.owner_id,
  'owner'
FROM venues v
WHERE v.venue_id = 'venue-1e02af4d'
  AND v.owner_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20'
ON CONFLICT (venue_id, user_id) 
DO UPDATE SET role = 'owner';

-- Verify the fix
SELECT 
  'FIXED: Your Access' as status,
  uvr.venue_id,
  uvr.role,
  u.email,
  v.name as venue_name
FROM user_venue_roles uvr
JOIN auth.users u ON u.id = uvr.user_id
JOIN venues v ON v.venue_id = uvr.venue_id
WHERE u.email = 'amaantanveer667@gmail.com';
